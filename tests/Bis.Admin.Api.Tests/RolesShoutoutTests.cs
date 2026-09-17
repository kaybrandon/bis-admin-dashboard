using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Bis.Admin.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace Bis.Admin.Api.Tests;

public class IsolatedAdminFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public string DbPath { get; } = Path.Combine(Path.GetTempPath(), $"admin-roles-{Guid.NewGuid():N}.db");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("ConnectionStrings:Default", "Data Source=" + DbPath);
        builder.UseSetting("AUTH_SECRET", "test-auth-secret-key-32-bytes-min!!");
        builder.UseSetting("VAULT_DEK", "YmlzLWFkbWluLWxvY2FsLW9ubHktdmF1bHQtZGVrMzI=");
        builder.UseSetting("SSO_ENABLED", "false");
        builder.UseSetting("APP_BASE_URL", "http://localhost:5173");
    }

    public async Task InitializeAsync()
    {
        using var client = CreateClient();
        (await client.GetAsync("/health")).EnsureSuccessStatusCode();
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await DisposeAsync();
        try { File.Delete(DbPath); } catch { /* leftover test db is harmless */ }
    }
}

public class RolesShoutoutTests : IClassFixture<IsolatedAdminFactory>
{
    private readonly IsolatedAdminFactory _factory;
    private static readonly Guid Brandon = Guid.Parse("22222222-2222-2222-2222-222222222201");
    private static readonly Guid Maya = Guid.Parse("22222222-2222-2222-2222-222222222202");
    private static readonly Guid Chris = Guid.Parse("22222222-2222-2222-2222-222222222203");

    public RolesShoutoutTests(IsolatedAdminFactory factory) => _factory = factory;

    [Fact]
    public async Task Grant_revoke_persists_no_self_promote_maya_cannot_shout()
    {
        var client = _factory.CreateClient();
        var brandon = await Login(client, "brandon@bisconsultants.example");
        Assert.Equal("admin", brandon.GetProperty("user").GetProperty("role").GetString());
        Assert.True(brandon.GetProperty("user").GetProperty("isGlobalAdmin").GetBoolean());
        Assert.True(brandon.GetProperty("user").GetProperty("dashboardAdmin").GetBoolean());
        client.DefaultRequestHeaders.Authorization = Bearer(brandon);

        var roles = await client.GetFromJsonAsync<JsonElement>("/api/roles");
        Assert.Contains(roles.EnumerateArray(), u =>
            u.GetProperty("email").GetString() == "brandon@bisconsultants.example"
            && u.GetProperty("isGlobalAdmin").GetBoolean()
            && u.GetProperty("dashboardAdmin").GetBoolean());
        Assert.Contains(roles.EnumerateArray(), u =>
            u.GetProperty("email").GetString() == "maya@bisconsultants.example"
            && !u.GetProperty("dashboardAdmin").GetBoolean());

        var selfGrant = await client.PostAsync($"/api/roles/{Brandon}/grant", null);
        Assert.Equal(HttpStatusCode.BadRequest, selfGrant.StatusCode);
        var selfRevoke = await client.PostAsync($"/api/roles/{Brandon}/revoke", null);
        Assert.Equal(HttpStatusCode.BadRequest, selfRevoke.StatusCode);

        var grant = await client.PostAsync($"/api/roles/{Chris}/grant", null);
        grant.EnsureSuccessStatusCode();
        var granted = await grant.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(granted.GetProperty("dashboardAdmin").GetBoolean());

        var afterGrant = await client.GetFromJsonAsync<JsonElement>("/api/roles");
        Assert.Contains(afterGrant.EnumerateArray(), u =>
            u.GetProperty("id").GetString() == Chris.ToString() && u.GetProperty("dashboardAdmin").GetBoolean());

        var revoke = await client.PostAsync($"/api/roles/{Chris}/revoke", null);
        revoke.EnsureSuccessStatusCode();
        var revoked = await revoke.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(revoked.GetProperty("dashboardAdmin").GetBoolean());

        var afterRevoke = await client.GetFromJsonAsync<JsonElement>("/api/roles");
        Assert.Contains(afterRevoke.EnumerateArray(), u =>
            u.GetProperty("id").GetString() == Chris.ToString() && !u.GetProperty("dashboardAdmin").GetBoolean());

        var maya = await Login(client, "maya@bisconsultants.example");
        Assert.Equal("staff", maya.GetProperty("user").GetProperty("role").GetString());
        Assert.False(maya.GetProperty("user").GetProperty("dashboardAdmin").GetBoolean());
        client.DefaultRequestHeaders.Authorization = Bearer(maya);

        var mayaGrant = await client.PostAsync($"/api/roles/{Chris}/grant", null);
        Assert.Equal(HttpStatusCode.Forbidden, mayaGrant.StatusCode);
        var mayaShout = await client.PostAsJsonAsync("/api/shoutouts", new
        {
            preset = "High five",
            emoji = "🙌",
            text = "Nice week so far"
        });
        Assert.Equal(HttpStatusCode.Forbidden, mayaShout.StatusCode);
        var feed = await client.GetFromJsonAsync<JsonElement>("/api/shoutouts");
        Assert.False(feed.GetProperty("canSend").GetBoolean());
    }

    [Fact]
    public async Task Brandon_shout_toasts_and_rate_limits()
    {
        var client = _factory.CreateClient();
        var brandon = await Login(client, "brandon@bisconsultants.example");
        client.DefaultRequestHeaders.Authorization = Bearer(brandon);

        var empty = await client.PostAsJsonAsync("/api/shoutouts", new { preset = "", emoji = "", text = "" });
        Assert.Equal(HttpStatusCode.BadRequest, empty.StatusCode);
        var tooLong = await client.PostAsJsonAsync("/api/shoutouts", new
        {
            preset = "Congratulations",
            emoji = "🎉",
            text = new string('x', 81)
        });
        Assert.Equal(HttpStatusCode.BadRequest, tooLong.StatusCode);

        var before = DateTime.UtcNow.AddSeconds(-1);
        var send = await client.PostAsJsonAsync("/api/shoutouts", new
        {
            preset = "High five",
            emoji = "🙌",
            text = "Nice week so far"
        });
        send.EnsureSuccessStatusCode();
        var body = await send.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(body.GetProperty("sound").GetBoolean());
        Assert.Equal(6, body.GetProperty("toastSeconds").GetInt32());
        var item = body.GetProperty("item");
        Assert.Equal("High five 🙌 — Nice week so far", item.GetProperty("message").GetString());
        Assert.Equal("Brandon", item.GetProperty("from").GetString());
        Assert.True(body.GetProperty("cooldownSeconds").GetInt32() >= 120);

        var again = await client.PostAsJsonAsync("/api/shoutouts", new
        {
            preset = "Good morning",
            emoji = "😊",
            text = ""
        });
        Assert.Equal(HttpStatusCode.TooManyRequests, again.StatusCode);
        var limited = await again.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(limited.GetProperty("retryAfterSeconds").GetInt32() > 0);
        Assert.StartsWith("Wait ", limited.GetProperty("waitLabel").GetString());

        var feed = await client.GetFromJsonAsync<JsonElement>("/api/shoutouts?after=" + Uri.EscapeDataString(before.ToString("o")));
        Assert.True(feed.GetProperty("canSend").GetBoolean());
        Assert.True(feed.GetProperty("cooldownSeconds").GetInt32() > 0);
        Assert.Contains(feed.GetProperty("items").EnumerateArray(), s =>
            s.GetProperty("message").GetString() == "High five 🙌 — Nice week so far"
            && s.GetProperty("from").GetString() == "Brandon");
    }

    private static AuthenticationHeaderValue Bearer(JsonElement login) =>
        new("Bearer", login.GetProperty("token").GetString());

    private static async Task<JsonElement> Login(HttpClient client, string email)
    {
        var res = await client.PostAsJsonAsync("/api/auth/login", new { email, password = SeedData.SeedPassword });
        res.EnsureSuccessStatusCode();
        return await res.Content.ReadFromJsonAsync<JsonElement>();
    }
}
