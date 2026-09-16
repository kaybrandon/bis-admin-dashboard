using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Bis.Admin.Api.Data;
using Bis.Admin.Api.Models;
using Microsoft.EntityFrameworkCore;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;

namespace Bis.Admin.Api.Services;

public record Actor(Guid? Id, string Role, string Name, string Email)
{
    public bool IsAdmin => Role == Roles.Admin;
    public bool IsStaff => Role is Roles.Staff or Roles.Admin;
    public bool IsToken => Role == Roles.Token;
    public static Actor From(ClaimsPrincipal user) => new(
        Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub"), out var id) ? id : null,
        user.FindFirstValue(ClaimTypes.Role) ?? Roles.Staff,
        user.FindFirstValue(ClaimTypes.Name) ?? user.Identity?.Name ?? "",
        user.FindFirstValue(ClaimTypes.Email) ?? "");
}

public class MentionService
{
    private static readonly Regex At = new(@"@([A-Za-z][A-Za-z0-9._-]*)", RegexOptions.Compiled);

    public async Task CaptureAsync(AppDbContext db, string text, string sourceType, Guid sourceId, Guid? actorId, CancellationToken ct)
    {
        var names = At.Matches(text).Select(m => m.Groups[1].Value).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        if (names.Count == 0) return;
        var users = await db.Users.ToListAsync(ct);
        foreach (var name in names)
        {
            var match = users.FirstOrDefault(u =>
                u.Name.StartsWith(name, StringComparison.OrdinalIgnoreCase) ||
                u.Name.Split(' ')[0].Equals(name, StringComparison.OrdinalIgnoreCase));
            if (match is null) continue;
            db.Mentions.Add(new Mention
            {
                Id = Guid.NewGuid(),
                UserId = match.Id,
                SourceType = sourceType,
                SourceId = sourceId,
                Snippet = text.Length > 240 ? text[..240] : text,
                CreatedAt = DateTime.UtcNow
            });
        }
        await db.SaveChangesAsync(ct);
    }
}

public class FileStore
{
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<FileStore> _log;

    public FileStore(IConfiguration config, IWebHostEnvironment env, ILogger<FileStore> log)
    {
        _config = config;
        _env = env;
        _log = log;
    }

    public async Task<(string Key, string Mime, long Bytes)> SaveAsync(Stream input, string fileName, string contentType, bool compressImages, CancellationToken ct)
    {
        var container = _config["BLOB_CONTAINER"] ?? "files";
        var isImage = contentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase);
        byte[] payload;
        var mime = contentType;
        await using (var ms = new MemoryStream())
        {
            await input.CopyToAsync(ms, ct);
            payload = ms.ToArray();
        }
        if (isImage && compressImages)
        {
            payload = Compress(payload);
            mime = "image/jpeg";
            fileName = Path.ChangeExtension(fileName, ".jpg");
        }
        var key = $"{DateTime.UtcNow:yyyy/MM}/{Guid.NewGuid():N}-{Sanitize(fileName)}";
        var conn = _config["Blob:ConnectionString"] ?? _config["AZURE_STORAGE_CONNECTION_STRING"];
        if (!string.IsNullOrWhiteSpace(conn))
        {
            var client = new BlobContainerClient(conn, container);
            await client.CreateIfNotExistsAsync(PublicAccessType.None, cancellationToken: ct);
            var blob = client.GetBlobClient(key);
            await blob.UploadAsync(new BinaryData(payload), new BlobUploadOptions
            {
                HttpHeaders = new BlobHttpHeaders { ContentType = mime }
            }, ct);
        }
        else
        {
            var root = Path.Combine(_env.ContentRootPath, "data", container);
            var path = Path.Combine(root, key.Replace('/', Path.DirectorySeparatorChar));
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            await File.WriteAllBytesAsync(path, payload, ct);
        }
        _log.LogInformation("Stored file {Key} bytes={Bytes} mime={Mime}", key, payload.Length, mime);
        return (key, mime, payload.Length);
    }

    public async Task<(Stream Stream, string Mime)?> OpenAsync(string key, string mime, CancellationToken ct)
    {
        var container = _config["BLOB_CONTAINER"] ?? "files";
        var conn = _config["Blob:ConnectionString"] ?? _config["AZURE_STORAGE_CONNECTION_STRING"];
        if (!string.IsNullOrWhiteSpace(conn))
        {
            var client = new BlobContainerClient(conn, container);
            var blob = client.GetBlobClient(key);
            if (!await blob.ExistsAsync(ct)) return null;
            var dl = await blob.DownloadStreamingAsync(cancellationToken: ct);
            return (dl.Value.Content, mime);
        }
        var path = Path.Combine(_env.ContentRootPath, "data", container, key.Replace('/', Path.DirectorySeparatorChar));
        if (!File.Exists(path)) return null;
        return (File.OpenRead(path), mime);
    }

    private static byte[] Compress(byte[] input)
    {
        using var image = Image.Load(input);
        var max = 1600;
        if (image.Width > max || image.Height > max)
        {
            image.Mutate(x => x.Resize(new ResizeOptions
            {
                Mode = ResizeMode.Max,
                Size = new Size(max, max)
            }));
        }
        using var outMs = new MemoryStream();
        image.Save(outMs, new JpegEncoder { Quality = 72 });
        return outMs.ToArray();
    }

    private static string Sanitize(string name)
    {
        var n = Path.GetFileName(name);
        return Regex.Replace(n, @"[^\w.\-]+", "_");
    }
}

public static class TokenHash
{
    public static string Sha256(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    public static string NewAccessToken()
    {
        var raw = Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();
        return "adm_ext_" + raw;
    }
}

public static class JsonUtil
{
    public static Dictionary<string, JsonElement>? ParseMap(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        return JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(json);
    }
}
