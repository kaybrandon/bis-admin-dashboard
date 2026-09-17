using System.Text.Json;
using Bis.Admin.Api.Data;
using Bis.Admin.Api.Models;

namespace Bis.Admin.Api.Services;

public class AuditWriter
{
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = false };
    private readonly AppDbContext _db;
    private readonly ILogger<AuditWriter> _log;

    public AuditWriter(AppDbContext db, ILogger<AuditWriter> log)
    {
        _db = db;
        _log = log;
    }

    public async Task WriteAsync(
        Guid? actorId,
        string action,
        string objectType,
        Guid? objectId,
        Guid? clientId,
        object? before,
        object? after,
        string? reason = null,
        CancellationToken ct = default)
    {
        var row = new Audit
        {
            Id = Guid.NewGuid(),
            ActorId = actorId,
            Action = action,
            ObjectType = objectType,
            ObjectId = objectId,
            ClientId = clientId,
            BeforeJson = Sanitize(before),
            AfterJson = Sanitize(after),
            Reason = reason,
            CreatedAt = DateTime.UtcNow
        };
        _db.Audits.Add(row);
        await _db.SaveChangesAsync(ct);
        _log.LogInformation("Audit {Action} {ObjectType} {ObjectId} actor={Actor}", action, objectType, objectId, actorId);
    }

    public static string? Sanitize(object? value)
    {
        if (value is null) return null;
        var node = JsonSerializer.SerializeToNode(value, Json);
        StripSecrets(node);
        return node?.ToJsonString(Json);
    }

    private static void StripSecrets(System.Text.Json.Nodes.JsonNode? node)
    {
        if (node is System.Text.Json.Nodes.JsonObject obj)
        {
            var kill = obj
                .Select(p => p.Key)
                .Where(k =>
                    k.Contains("secret", StringComparison.OrdinalIgnoreCase) ||
                    k.Contains("password", StringComparison.OrdinalIgnoreCase) ||
                    k.Contains("cipher", StringComparison.OrdinalIgnoreCase) ||
                    k.Equals("iv", StringComparison.OrdinalIgnoreCase) ||
                    k.Contains("token", StringComparison.OrdinalIgnoreCase) && k.Contains("raw", StringComparison.OrdinalIgnoreCase))
                .ToList();
            foreach (var k in kill) obj.Remove(k);
            foreach (var p in obj.ToList()) StripSecrets(p.Value);
        }
        else if (node is System.Text.Json.Nodes.JsonArray arr)
        {
            foreach (var item in arr) StripSecrets(item);
        }
    }
}
