using System.Text;

namespace Bis.Admin.Api.Services;

/// <summary>Minimal one-page PDF for Reports export. Time hours only — never vault.</summary>
public static class SimplePdf
{
    public static byte[] FromLines(string title, IEnumerable<string> lines)
    {
        var body = new StringBuilder();
        body.Append("BT\n/F1 14 Tf\n48 750 Td\n(").Append(Esc(title)).Append(") Tj\n/F1 9 Tf\n0 -18 Td\n");
        var n = 0;
        foreach (var raw in lines)
        {
            if (n++ >= 52) break;
            var line = raw.Length > 110 ? raw[..110] : raw;
            body.Append('(').Append(Esc(line)).Append(") Tj\n0 -12 Td\n");
        }
        body.Append("ET\n");
        var stream = Encoding.ASCII.GetBytes(body.ToString());

        var objects = new[]
        {
            Encoding.ASCII.GetBytes("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n"),
            Encoding.ASCII.GetBytes("2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n"),
            Encoding.ASCII.GetBytes("3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n"),
            Encoding.ASCII.GetBytes($"4 0 obj<< /Length {stream.Length} >>stream\n").Concat(stream).Concat(Encoding.ASCII.GetBytes("endstream\nendobj\n")).ToArray(),
            Encoding.ASCII.GetBytes("5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n")
        };

        using var ms = new MemoryStream();
        ms.Write(Encoding.ASCII.GetBytes("%PDF-1.4\n"));
        var offsets = new List<long> { 0 };
        foreach (var obj in objects)
        {
            offsets.Add(ms.Position);
            ms.Write(obj);
        }
        var xrefAt = ms.Position;
        var xref = new StringBuilder();
        xref.Append("xref\n0 ").Append(objects.Length + 1).Append('\n');
        xref.Append("0000000000 65535 f \n");
        for (var i = 1; i < offsets.Count; i++)
            xref.Append(offsets[i].ToString("D10")).Append(" 00000 n \n");
        xref.Append("trailer<< /Size ").Append(objects.Length + 1).Append(" /Root 1 0 R >>\nstartxref\n")
            .Append(xrefAt).Append("\n%%EOF\n");
        ms.Write(Encoding.ASCII.GetBytes(xref.ToString()));
        return ms.ToArray();
    }

    private static string Esc(string? s) =>
        (s ?? "").Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("(", "\\(", StringComparison.Ordinal)
            .Replace(")", "\\)", StringComparison.Ordinal)
            .Replace("\r", " ", StringComparison.Ordinal)
            .Replace("\n", " ", StringComparison.Ordinal);
}
