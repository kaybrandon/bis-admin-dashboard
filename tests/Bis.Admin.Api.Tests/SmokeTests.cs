using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Bis.Admin.Api.Data;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace Bis.Admin.Api.Tests;

public class SmokeTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public SmokeTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(b =>
        {
            b.UseSetting("ConnectionStrings:Default", "Data Source=data/test-admin.db");
            b.UseSetting("AUTH_SECRET", "test-auth-secret-key-32-bytes-min!!");
            b.UseSetting("VAULT_DEK", "YmlzLWFkbWluLWxvY2FsLW9ubHktdmF1bHQtZGVrMzI=");
            b.UseSetting("SSO_ENABLED", "false");
            b.UseSetting("APP_BASE_URL", "http://localhost:5173");
        });
    }

    [Fact]
    public async Task Health_ok()
    {
        var client = _factory.CreateClient();
        var res = await client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var json = await res.Content.ReadAsStringAsync();
        Assert.Contains("Admin", json);
    }

    [Fact]
    public async Task Brandon_is_admin_Maya_blocked_from_export_reports_audit()
    {
        var client = _factory.CreateClient();
        var brandon = await Login(client, "brandon@bisconsultants.example");
        Assert.Equal("admin", brandon.GetProperty("user").GetProperty("role").GetString());
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", brandon.GetProperty("token").GetString());
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/home")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/reports")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/audit")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/admin/export/clients")).StatusCode);

        var maya = await Login(client, "maya@bisconsultants.example");
        Assert.Equal("staff", maya.GetProperty("user").GetProperty("role").GetString());
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", maya.GetProperty("token").GetString());
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/reports")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/audit")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/admin/users")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/admin/export/clients")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/export/clients")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/time")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/clients")).StatusCode);
    }

    [Fact]
    public async Task Vault_list_has_no_plaintext_and_reveal_is_explicit()
    {
        var client = _factory.CreateClient();
        var brandon = await Login(client, "brandon@bisconsultants.example");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", brandon.GetProperty("token").GetString());
        var clients = await client.GetFromJsonAsync<JsonElement>("/api/clients");
        Guid? murrayId = null;
        foreach (var c in clients.EnumerateArray())
            if (c.GetProperty("name").GetString() == "Murray Media")
                murrayId = Guid.Parse(c.GetProperty("id").GetString()!);
        Assert.NotNull(murrayId);
        var file = await client.GetFromJsonAsync<JsonElement>($"/api/clients/{murrayId}");
        var fileJson = file.ToString();
        Assert.DoesNotContain("not-a-real-nas-secret", fileJson);
        Assert.Contains("••••••••", fileJson);
        var vault = file.GetProperty("vault");
        var first = vault.EnumerateArray().First();
        var credId = first.GetProperty("id").GetString();
        var reveal = await client.PostAsync($"/api/clients/{murrayId}/vault/{credId}/reveal", null);
        Assert.Equal(HttpStatusCode.OK, reveal.StatusCode);
        var revealed = await reveal.Content.ReadAsStringAsync();
        Assert.Contains("not-a-real", revealed);
        var print = await client.GetFromJsonAsync<JsonElement>($"/api/clients/{murrayId}/print");
        var printJson = print.ToString();
        Assert.DoesNotContain("not-a-real", printJson);
        Assert.Equal(JsonValueKind.Array, print.GetProperty("vault").ValueKind);
        Assert.Equal(0, print.GetProperty("vault").GetArrayLength());
        var audit = await client.GetFromJsonAsync<JsonElement>("/api/audit");
        Assert.DoesNotContain("not-a-real-nas-secret", audit.ToString());
    }

    [Fact]
    public async Task Access_token_cannot_hit_vault_or_admin()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "adm_ext_deadbeefdeadbeefdeadbeef");
        var vault = await client.GetAsync($"/api/clients/{Guid.Parse("66666666-6666-6666-6666-666666666601")}/vault");
        Assert.True(vault.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden);
        var admin = await client.GetAsync("/api/admin/users");
        Assert.True(admin.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task OpenApi_documents_home_clients_flags()
    {
        var client = _factory.CreateClient();
        var res = await client.GetAsync("/swagger/v1/swagger.json");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var json = await res.Content.ReadAsStringAsync();
        Assert.Contains("BIS Admin API", json);
        Assert.Contains("/api/home", json);
        Assert.Contains("/api/clients", json);
        Assert.Contains("/api/flags", json);
        Assert.Contains("HomeBoardDto", json);
        Assert.Contains("ClientFileDto", json);
        Assert.Contains("FlagRowDto", json);
    }

    [Fact]
    public async Task Sso_is_off()
    {
        var client = _factory.CreateClient();
        var res = await client.GetAsync("/api/auth/sso/start");
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [Fact]
    public async Task Murray_media_seed_is_complete()
    {
        var client = _factory.CreateClient();
        var brandon = await Login(client, "brandon@bisconsultants.example");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", brandon.GetProperty("token").GetString());
        var file = await client.GetFromJsonAsync<JsonElement>("/api/clients/66666666-6666-6666-6666-666666666601");
        Assert.Equal("Murray Media", file.GetProperty("name").GetString());
        Assert.Equal("(940) 555-2500", file.GetProperty("business").GetProperty("call").GetString());
        Assert.True(file.GetProperty("people").GetArrayLength() >= 5);
        Assert.Equal(2, file.GetProperty("addresses").GetArrayLength());
        Assert.True(file.GetProperty("flags").GetArrayLength() >= 2);
        Assert.True(file.GetProperty("vault").GetArrayLength() >= 4);
        var people = file.GetProperty("people").EnumerateArray().Select(p => p.GetProperty("name").GetString()).ToList();
        Assert.Contains("Bre", people);
        Assert.Contains("Scott", people);
        Assert.Contains("Jordan Hale", people);
        Assert.Contains("Ronnie", people);
        Assert.Contains("Ana Ruiz", people);
    }

    private static async Task<JsonElement> Login(HttpClient client, string email)
    {
        var res = await client.PostAsJsonAsync("/api/auth/login", new { email, password = SeedData.SeedPassword });
        res.EnsureSuccessStatusCode();
        return await res.Content.ReadFromJsonAsync<JsonElement>();
    }
}
