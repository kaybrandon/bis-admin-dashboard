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
        Assert.Contains("/api/posts/{id}/thumbs", json);
        Assert.Contains("/api/clients", json);
        Assert.Contains("/api/clients/{id}/services", json);
        Assert.Contains("/api/clients/{id}/links", json);
        Assert.Contains("/api/clients/{id}/vendors", json);
        Assert.Contains("/api/admin/services", json);
        Assert.Contains("/api/flags", json);
        Assert.Contains("/api/settings", json);
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
    public async Task Home_weekLabel_starOfDay_guid_clients_service_and_seed_files()
    {
        var client = _factory.CreateClient();
        var brandon = await Login(client, "brandon@bisconsultants.example");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", brandon.GetProperty("token").GetString());

        var home = await client.GetFromJsonAsync<JsonElement>("/api/home");
        var label = home.GetProperty("weekLabel").GetString();
        Assert.Contains("America/Chicago", label);
        Assert.DoesNotMatch(@"\d{1,2}/\d{1,2}/\d{4}", label);
        Assert.Matches(@"^[A-Z][a-z]{2} \d{1,2}–", label);
        var weekStart = home.GetProperty("weekStart").GetString();
        Assert.Matches(@"^\d{4}-\d{2}-\d{2}$", weekStart);
        var star = home.GetProperty("starOfDay");
        Assert.Equal(JsonValueKind.Object, star.ValueKind);
        Assert.True(Guid.TryParse(star.GetProperty("from").GetString(), out var from));
        Assert.NotEqual(Guid.Empty, from);

        var mit = await client.GetFromJsonAsync<JsonElement>("/api/clients?service=Managed%20IT");
        Assert.Contains(mit.EnumerateArray(), c => c.GetProperty("name").GetString() == "Murray Media");
        var none = await client.GetFromJsonAsync<JsonElement>("/api/clients?service=No-Such-Service");
        Assert.Equal(0, none.GetArrayLength());

        var file = await client.GetFromJsonAsync<JsonElement>("/api/clients/66666666-6666-6666-6666-666666666601");
        Assert.True(file.GetProperty("files").GetArrayLength() >= 1);
        var fileId = file.GetProperty("files")[0].GetProperty("id").GetString();
        var dl = await client.GetAsync("/files/" + fileId);
        Assert.Equal(HttpStatusCode.OK, dl.StatusCode);
        Assert.True((await dl.Content.ReadAsByteArrayAsync()).Length > 0);
        var dlApi = await client.GetAsync("/api/files/" + fileId);
        Assert.Equal(HttpStatusCode.OK, dlApi.StatusCode);
    }

    [Fact]
    public async Task Win_board_posts_expose_thumbs_count_and_comment()
    {
        var client = _factory.CreateClient();
        var brandon = await Login(client, "brandon@bisconsultants.example");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", brandon.GetProperty("token").GetString());

        var home = await client.GetFromJsonAsync<JsonElement>("/api/home");
        var win = home.GetProperty("posts").EnumerateArray().First(p => p.GetProperty("kind").GetString() == "win");
        Assert.True(win.TryGetProperty("thumbs", out var thumbsEl));
        var before = thumbsEl.GetInt32();
        var id = win.GetProperty("id").GetString();

        var thumb = await client.PostAsync($"/api/posts/{id}/thumbs", null);
        thumb.EnsureSuccessStatusCode();
        var first = await thumb.Content.ReadFromJsonAsync<JsonElement>();
        var count = first.GetProperty("thumbs").GetInt32();
        Assert.True(count >= before);

        var again = await client.PostAsync($"/api/posts/{id}/thumbs", null);
        again.EnsureSuccessStatusCode();
        var second = await again.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(count, second.GetProperty("thumbs").GetInt32());

        var comment = await client.PostAsJsonAsync($"/api/posts/{id}/comments", new { body = "Noted on the Win Board." });
        comment.EnsureSuccessStatusCode();
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
        Assert.Equal("info@murraymedia.example", file.GetProperty("business").GetProperty("email").GetString());
        var bre = file.GetProperty("people").EnumerateArray().First(p => p.GetProperty("name").GetString() == "Bre");
        Assert.True(bre.GetProperty("primary").GetBoolean());
        Assert.True(bre.GetProperty("pinned").GetBoolean());
        var scott = file.GetProperty("people").EnumerateArray().First(p => p.GetProperty("name").GetString() == "Scott");
        var pin = await client.PostAsJsonAsync($"/api/clients/66666666-6666-6666-6666-666666666601/people/{scott.GetProperty("id").GetString()}/pin", new { pinned = true });
        pin.EnsureSuccessStatusCode();
        var after = await client.GetFromJsonAsync<JsonElement>("/api/clients/66666666-6666-6666-6666-666666666601");
        var scottAfter = after.GetProperty("people").EnumerateArray().First(p => p.GetProperty("name").GetString() == "Scott");
        Assert.True(scottAfter.GetProperty("pinned").GetBoolean());
    }

    [Fact]
    public async Task Birthday_persists_on_profile_and_admin_team_edit()
    {
        var client = _factory.CreateClient();
        var brandon = await Login(client, "brandon@bisconsultants.example");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", brandon.GetProperty("token").GetString());

        var today = Bis.Admin.Api.Services.ChicagoClock.Today;
        var saveMe = await client.PutAsJsonAsync("/api/me", new
        {
            name = "Brandon Kay",
            birthdayMonth = today.Month,
            birthdayDay = today.Day
        });
        saveMe.EnsureSuccessStatusCode();
        var me = await saveMe.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(today.Month, DateOnly.Parse(me.GetProperty("birthday").GetString()!).Month);
        Assert.Equal(today.Day, DateOnly.Parse(me.GetProperty("birthday").GetString()!).Day);
        Assert.True(me.GetProperty("birthdayInWindow").GetBoolean());

        var home = await client.GetFromJsonAsync<JsonElement>("/api/home");
        Assert.Contains(home.GetProperty("birthdays").EnumerateArray(), b => b.GetProperty("name").GetString() == "Brandon Kay");
        Assert.Contains(home.GetProperty("celebrations").EnumerateArray(), c =>
            c.GetProperty("name").GetString() == "Brandon Kay" && c.GetProperty("kind").GetString() == "birthday");

        var mayaId = Guid.Parse("22222222-2222-2222-2222-222222222202");
        var adminSave = await client.PutAsJsonAsync($"/api/admin/users/{mayaId}", new { birthdayMonth = 6, birthdayDay = 15, birthdayYear = 1991 });
        adminSave.EnsureSuccessStatusCode();
        var team = await client.GetFromJsonAsync<JsonElement>($"/api/team/{mayaId}");
        Assert.Equal("1991-06-15", team.GetProperty("birthday").GetString());

        var maya = await Login(client, "maya@bisconsultants.example");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", maya.GetProperty("token").GetString());
        var blocked = await client.PutAsJsonAsync($"/api/admin/users/{mayaId}", new { birthdayMonth = 1, birthdayDay = 1 });
        Assert.Equal(HttpStatusCode.Forbidden, blocked.StatusCode);
        var own = await client.PutAsJsonAsync("/api/me", new { birthdayMonth = 3, birthdayDay = 8 });
        own.EnsureSuccessStatusCode();
        var ownJson = await own.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(3, DateOnly.Parse(ownJson.GetProperty("birthday").GetString()!).Month);
        Assert.Equal(8, DateOnly.Parse(ownJson.GetProperty("birthday").GetString()!).Day);
    }

    [Fact]
    public async Task Work_anniversary_persists_on_profile_and_admin_team_edit()
    {
        var client = _factory.CreateClient();
        var brandon = await Login(client, "brandon@bisconsultants.example");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", brandon.GetProperty("token").GetString());

        var today = Bis.Admin.Api.Services.ChicagoClock.Today;
        var saveMe = await client.PutAsJsonAsync("/api/me", new
        {
            name = "Brandon Kay",
            workAnniversaryMonth = today.Month,
            workAnniversaryDay = today.Day,
            workAnniversaryYear = 2014
        });
        saveMe.EnsureSuccessStatusCode();
        var me = await saveMe.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(today.Month, DateOnly.Parse(me.GetProperty("workAnniversary").GetString()!).Month);
        Assert.Equal(today.Day, DateOnly.Parse(me.GetProperty("workAnniversary").GetString()!).Day);
        Assert.True(me.GetProperty("workAnniversaryInWindow").GetBoolean());

        var home = await client.GetFromJsonAsync<JsonElement>("/api/home");
        Assert.Contains(home.GetProperty("anniversaries").EnumerateArray(), a => a.GetProperty("name").GetString() == "Brandon Kay");
        Assert.Contains(home.GetProperty("celebrations").EnumerateArray(), c =>
            c.GetProperty("name").GetString() == "Brandon Kay" && c.GetProperty("kind").GetString() == "anniversary");

        var mayaId = Guid.Parse("22222222-2222-2222-2222-222222222202");
        var adminSave = await client.PutAsJsonAsync($"/api/admin/users/{mayaId}", new { workAnniversaryMonth = 4, workAnniversaryDay = 12, workAnniversaryYear = 2019 });
        adminSave.EnsureSuccessStatusCode();
        var team = await client.GetFromJsonAsync<JsonElement>($"/api/team/{mayaId}");
        Assert.Equal("2019-04-12", team.GetProperty("workAnniversary").GetString());

        var maya = await Login(client, "maya@bisconsultants.example");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", maya.GetProperty("token").GetString());
        var blocked = await client.PutAsJsonAsync($"/api/admin/users/{mayaId}", new { workAnniversaryMonth = 1, workAnniversaryDay = 1 });
        Assert.Equal(HttpStatusCode.Forbidden, blocked.StatusCode);
        var own = await client.PutAsJsonAsync("/api/me", new { workAnniversaryMonth = 7, workAnniversaryDay = 4, workAnniversaryYear = 2022 });
        own.EnsureSuccessStatusCode();
        var ownJson = await own.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("2022-07-04", ownJson.GetProperty("workAnniversary").GetString());
    }

    [Fact]
    public async Task Brandon_edits_murray_file_and_catalog_maya_cannot_add_catalog()
    {
        var client = _factory.CreateClient();
        var murray = Guid.Parse("66666666-6666-6666-6666-666666666601");
        var websiteType = Guid.Parse("44444444-4444-4444-4444-444444444404");
        var brandon = await Login(client, "brandon@bisconsultants.example");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", brandon.GetProperty("token").GetString());

        var core = await client.PutAsJsonAsync($"/api/clients/{murray}", new
        {
            name = "Murray Media",
            industry = "Media",
            status = "Active",
            county = "Denton",
            businessPhone = "(940) 555-2599",
            businessEmail = "info@murraymedia.example",
            website = "https://murraymedia.example"
        });
        core.EnsureSuccessStatusCode();

        var fileAfterCore = await client.GetFromJsonAsync<JsonElement>($"/api/clients/{murray}");
        Assert.Equal("(940) 555-2599", fileAfterCore.GetProperty("businessPhone").GetString());
        Assert.Equal("(940) 555-2599", fileAfterCore.GetProperty("business").GetProperty("call").GetString());

        var restorePhone = await client.PutAsJsonAsync($"/api/clients/{murray}", new { businessPhone = "(940) 555-2500" });
        restorePhone.EnsureSuccessStatusCode();

        var bre = fileAfterCore.GetProperty("people").EnumerateArray().First(p => p.GetProperty("name").GetString() == "Bre");
        var personEdit = await client.PutAsJsonAsync($"/api/clients/{murray}/people/{bre.GetProperty("id").GetString()}", new
        {
            name = "Bre",
            title = "Owner",
            department = "Operations",
            email = "bre@murraymedia.example",
            phone = "(940) 555-0140",
            pinned = true,
            primary = true
        });
        personEdit.EnsureSuccessStatusCode();

        var studio = fileAfterCore.GetProperty("addresses").EnumerateArray().First(a => a.GetProperty("label").GetString() == "Studio");
        var addrEdit = await client.PutAsJsonAsync($"/api/clients/{murray}/addresses/{studio.GetProperty("id").GetString()}", new
        {
            label = "Studio",
            line1 = "1840 Script Lane",
            city = "Denton",
            state = "TX",
            zip = "76201",
            county = "Denton",
            hours = "Mon–Fri 8–6",
            isPrimary = true,
            phone = "(940) 555-2500"
        });
        addrEdit.EnsureSuccessStatusCode();

        var addSvc = await client.PostAsJsonAsync($"/api/clients/{murray}/services", new { serviceTypeId = websiteType, on = true, note = "Host and care" });
        addSvc.EnsureSuccessStatusCode();
        var svcId = (await addSvc.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString();
        var editSvc = await client.PutAsJsonAsync($"/api/clients/{murray}/services/{svcId}", new { on = false, note = "Paused" });
        editSvc.EnsureSuccessStatusCode();

        var addLink = await client.PostAsJsonAsync($"/api/clients/{murray}/links", new { label = "Billing portal", url = "billing.murraymedia.example" });
        addLink.EnsureSuccessStatusCode();
        var linkId = (await addLink.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString();
        var editLink = await client.PutAsJsonAsync($"/api/clients/{murray}/links/{linkId}", new { label = "Billing", url = "https://billing.murraymedia.example" });
        editLink.EnsureSuccessStatusCode();

        var addVendor = await client.PostAsJsonAsync($"/api/clients/{murray}/vendors", new { kind = "Power", name = "Oncor", phone = "(888) 555-0100" });
        addVendor.EnsureSuccessStatusCode();
        var vendorId = (await addVendor.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString();
        var editVendor = await client.PutAsJsonAsync($"/api/clients/{murray}/vendors/{vendorId}", new { kind = "Power", name = "Oncor Electric", phone = "(888) 555-0100" });
        editVendor.EnsureSuccessStatusCode();

        var file = await client.GetFromJsonAsync<JsonElement>($"/api/clients/{murray}");
        Assert.Contains(file.GetProperty("services").EnumerateArray(), s => s.GetProperty("name").GetString() == "Website" && !s.GetProperty("on").GetBoolean());
        Assert.Contains(file.GetProperty("links").EnumerateArray(), l => l.GetProperty("label").GetString() == "Billing" && l.GetProperty("url").GetString() == "https://billing.murraymedia.example");
        Assert.Contains(file.GetProperty("vendors").EnumerateArray(), v => v.GetProperty("name").GetString() == "Oncor Electric");

        var delSvc = await client.DeleteAsync($"/api/clients/{murray}/services/{svcId}");
        delSvc.EnsureSuccessStatusCode();
        var delLink = await client.DeleteAsync($"/api/clients/{murray}/links/{linkId}");
        delLink.EnsureSuccessStatusCode();
        var delVendor = await client.DeleteAsync($"/api/clients/{murray}/vendors/{vendorId}");
        delVendor.EnsureSuccessStatusCode();

        var catalogName = "Slice C Catalog " + Guid.NewGuid().ToString("N")[..8];
        var addCatalog = await client.PostAsJsonAsync("/api/admin/services", new { name = catalogName, description = "Admin-added type" });
        addCatalog.EnsureSuccessStatusCode();
        var catalog = await addCatalog.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(catalogName, catalog.GetProperty("name").GetString());
        var lookups = await client.GetFromJsonAsync<JsonElement>("/api/lookups");
        Assert.Contains(lookups.GetProperty("services").EnumerateArray(), s => s.GetProperty("name").GetString() == catalogName);

        var audit = await client.GetFromJsonAsync<JsonElement>("/api/audit");
        var auditJson = audit.ToString();
        Assert.Contains("clientService", auditJson);
        Assert.Contains("serviceType", auditJson);
        Assert.DoesNotContain("not-a-real-nas-secret", auditJson);

        var maya = await Login(client, "maya@bisconsultants.example");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", maya.GetProperty("token").GetString());
        var blocked = await client.PostAsJsonAsync("/api/admin/services", new { name = "Maya should not add this" });
        Assert.Equal(HttpStatusCode.Forbidden, blocked.StatusCode);
        var staffEdit = await client.PutAsJsonAsync($"/api/clients/{murray}", new { county = "Denton" });
        staffEdit.EnsureSuccessStatusCode();
        var staffSvc = await client.PostAsJsonAsync($"/api/clients/{murray}/services", new { serviceTypeId = websiteType, on = true, note = "Staff add" });
        staffSvc.EnsureSuccessStatusCode();
        var staffSvcId = (await staffSvc.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString();
        (await client.DeleteAsync($"/api/clients/{murray}/services/{staffSvcId}")).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Admin_can_edit_workspace_settings_staff_can_read()
    {
        var client = _factory.CreateClient();
        var brandon = await Login(client, "brandon@bisconsultants.example");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", brandon.GetProperty("token").GetString());

        var before = await client.GetFromJsonAsync<JsonElement>("/api/settings");
        Assert.False(string.IsNullOrWhiteSpace(before.GetProperty("companyName").GetString()));
        Assert.True(before.GetProperty("idleMinutes").GetInt32() >= 1);
        Assert.True(before.GetProperty("clipboardClearSeconds").GetInt32() >= 5);

        var badIdle = await client.PutAsJsonAsync("/api/admin/settings", new { idleMinutes = 0 });
        Assert.Equal(HttpStatusCode.BadRequest, badIdle.StatusCode);
        var badClip = await client.PutAsJsonAsync("/api/admin/settings", new { clipboardClearSeconds = 0 });
        Assert.Equal(HttpStatusCode.BadRequest, badClip.StatusCode);
        var badName = await client.PutAsJsonAsync("/api/admin/settings", new { companyName = "   " });
        Assert.Equal(HttpStatusCode.BadRequest, badName.StatusCode);

        var save = await client.PutAsJsonAsync("/api/admin/settings", new
        {
            companyName = "BIS Shop",
            idleMinutes = 20,
            clipboardClearSeconds = 45
        });
        save.EnsureSuccessStatusCode();

        var adminView = await client.GetFromJsonAsync<JsonElement>("/api/admin/settings");
        Assert.Equal("BIS Shop", adminView.GetProperty("companyName").GetString());
        Assert.Equal(20, adminView.GetProperty("idleMinutes").GetInt32());
        Assert.Equal(45, adminView.GetProperty("clipboardClearSeconds").GetInt32());

        var maya = await Login(client, "maya@bisconsultants.example");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", maya.GetProperty("token").GetString());
        var staffView = await client.GetFromJsonAsync<JsonElement>("/api/settings");
        Assert.Equal("BIS Shop", staffView.GetProperty("companyName").GetString());
        Assert.Equal(20, staffView.GetProperty("idleMinutes").GetInt32());
        Assert.Equal(45, staffView.GetProperty("clipboardClearSeconds").GetInt32());
        var blocked = await client.PutAsJsonAsync("/api/admin/settings", new { companyName = "Nope" });
        Assert.Equal(HttpStatusCode.Forbidden, blocked.StatusCode);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", brandon.GetProperty("token").GetString());
        var restore = await client.PutAsJsonAsync("/api/admin/settings", new
        {
            companyName = "BIS Consultants",
            idleMinutes = 15,
            clipboardClearSeconds = 30
        });
        restore.EnsureSuccessStatusCode();
    }

    private static async Task<JsonElement> Login(HttpClient client, string email)
    {
        var res = await client.PostAsJsonAsync("/api/auth/login", new { email, password = SeedData.SeedPassword });
        res.EnsureSuccessStatusCode();
        return await res.Content.ReadFromJsonAsync<JsonElement>();
    }
}
