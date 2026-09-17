using System.Security.Cryptography;

namespace Bis.Admin.Api.Services;

public class VaultCrypto
{
    private readonly byte[] _key;

    public VaultCrypto(IConfiguration config, ILogger<VaultCrypto> log)
    {
        var raw = config["VAULT_DEK"] ?? config["Vault:Dek"] ?? "";
        if (string.IsNullOrWhiteSpace(raw))
            throw new InvalidOperationException("VAULT_DEK is required (32-byte key, base64 or hex).");
        _key = DecodeKey(raw);
        if (_key.Length != 32)
            throw new InvalidOperationException("VAULT_DEK must decode to 32 bytes for AES-256-GCM.");
        log.LogInformation("Vault crypto initialized (AES-256-GCM). Key material is not logged.");
    }

    public (byte[] Iv, byte[] Cipher) Encrypt(string plaintext)
    {
        var iv = RandomNumberGenerator.GetBytes(12);
        var plain = System.Text.Encoding.UTF8.GetBytes(plaintext);
        var cipher = new byte[plain.Length];
        var tag = new byte[16];
        using var gcm = new AesGcm(_key, 16);
        gcm.Encrypt(iv, plain, cipher, tag);
        var packed = new byte[cipher.Length + tag.Length];
        Buffer.BlockCopy(cipher, 0, packed, 0, cipher.Length);
        Buffer.BlockCopy(tag, 0, packed, cipher.Length, tag.Length);
        CryptographicOperations.ZeroMemory(plain);
        return (iv, packed);
    }

    public string Decrypt(byte[] iv, byte[] packed)
    {
        if (packed.Length < 16) throw new CryptographicException("Invalid vault payload.");
        var cipherLen = packed.Length - 16;
        var cipher = packed.AsSpan(0, cipherLen);
        var tag = packed.AsSpan(cipherLen, 16);
        var plain = new byte[cipherLen];
        using var gcm = new AesGcm(_key, 16);
        gcm.Decrypt(iv, cipher, tag, plain);
        var text = System.Text.Encoding.UTF8.GetString(plain);
        CryptographicOperations.ZeroMemory(plain);
        return text;
    }

    private static byte[] DecodeKey(string raw)
    {
        raw = raw.Trim();
        try { return Convert.FromBase64String(raw); }
        catch (FormatException)
        {
            if (raw.Length == 64 && raw.All(Uri.IsHexDigit))
                return Convert.FromHexString(raw);
            throw new InvalidOperationException("VAULT_DEK must be base64 or 64-char hex.");
        }
    }
}
