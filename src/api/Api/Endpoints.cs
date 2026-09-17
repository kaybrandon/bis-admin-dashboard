using System.Globalization;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Bis.Admin.Api.Auth;
using Bis.Admin.Api.Data;
using Bis.Admin.Api.Models;
using Bis.Admin.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Bis.Admin.Api.Api;

public static class Endpoints
{
    public static void MapAdminApi(this WebApplication app)
    {
        app.MapGet("/health", () => Results.Ok(new { status = "ok", product = "Admin", tz = "America/Chicago" }));
        app.MapGet("/api/health", () => Results.Ok(new { status = "ok", product = "Admin" }));

        var api = app.MapGroup("/api");
        MapAuth(api);
        MapHome(api);
        MapClients(api);
        MapFlags(api);
        MapTeam(api);
        MapTime(api);
        MapReports(api);
        MapAudit(api);
        MapBoard(api);
        MapKudos(api);
        MapMentions(api);
        MapAdmin(api);
        MapFiles(api);
        app.MapGet("/files/{id:guid}", DownloadFile).RequireAuthorization();
    }

    private static void MapAuth(RouteGroupBuilder api)
    {
        api.MapPost("/auth/login", async (LoginRequest req, AppDbContext db, JwtSettings jwt, AuditWriter audit, IConfiguration cfg) =>
        {
            var user = await db.Users.Include(u => u.Department).Include(u => u.Manager)
                .FirstOrDefaultAsync(u => u.Email.ToLower() == req.Email.Trim().ToLower());
            if (user is null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
                return Results.Json(new { error = "Invalid email or password" }, statusCode: 401);
            user.LastSeenAt = DateTime.UtcNow;
            user.LastActiveAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            var token = AuthSetup.IssueJwt(jwt, user);
            await audit.WriteAsync(user.Id, "login", "user", user.Id, null, null, new { user.Email }, null);
            var open = await OpenPunch(db, user.Id);
            return Results.Ok(new
            {
                token,
                expiresInMinutes = 15,
                user = Maps.UserCard(user, open, 0, 0, 0),
                ssoEnabled = string.Equals(cfg["SSO_ENABLED"], "true", StringComparison.OrdinalIgnoreCase)
            });
        });

        api.MapGet("/auth/sso/start", (IConfiguration cfg) =>
        {
            if (!string.Equals(cfg["SSO_ENABLED"], "true", StringComparison.OrdinalIgnoreCase))
                return Results.Json(new { error = "SSO is built but off (SSO_ENABLED=false)." }, statusCode: 403);
            return Results.Ok(new { url = "/auth/oidc" });
        });

        api.MapPost("/auth/logout", async (HttpContext ctx, AppDbContext db, AuditWriter audit) =>
        {
            var deny = Authz.RequireHumanStaff(ctx);
            if (deny is not null && ctx.User.Identity?.IsAuthenticated != true) return Results.Ok();
            var actor = Authz.Actor(ctx);
            if (actor.Id is Guid uid)
            {
                var open = await OpenPunch(db, uid);
                if (open is { Dir: "in" })
                {
                    db.Punches.Add(new Punch
                    {
                        Id = Guid.NewGuid(),
                        UserId = uid,
                        Dir = "out",
                        Workplace = open.Workplace,
                        Destination = open.Destination,
                        At = DateTime.UtcNow
                    });
                    await db.SaveChangesAsync();
                    await audit.WriteAsync(uid, "clock-out", "punch", null, null, null, new { reason = "sign-out" }, "Signed out");
                }
                await audit.WriteAsync(uid, "logout", "user", uid, null, null, null, null);
            }
            return Results.Ok(new { ok = true });
        }).RequireAuthorization();

        api.MapGet("/auth/me", async (HttpContext ctx, AppDbContext db) =>
        {
            var deny = Authz.RequireStaff(ctx);
            if (deny is not null && !Authz.Actor(ctx).IsToken) return deny;
            var actor = Authz.Actor(ctx);
            if (actor.IsToken) return Results.Ok(new { role = Roles.Token, name = actor.Name, token = true });
            if (actor.Id is null) return Results.Unauthorized();
            var user = await db.Users.Include(u => u.Department).Include(u => u.Manager).FirstAsync(u => u.Id == actor.Id);
            user.LastActiveAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            var open = await OpenPunch(db, user.Id);
            var week = ChicagoClock.WeekStart();
            var month = ChicagoClock.MonthStart;
            var kudosWeek = await db.Kudos.CountAsync(k => k.ToUserId == user.Id && k.WeekStart == week);
            var kudosMonth = await db.Kudos.CountAsync(k => k.ToUserId == user.Id && k.WeekStart >= month);
            var mentionsWeek = await db.Mentions.CountAsync(m => m.UserId == user.Id && m.CreatedAt >= week.ToDateTime(TimeOnly.MinValue).ToUniversalTime());
            return Results.Ok(Maps.UserCard(user, open, kudosWeek, kudosMonth, mentionsWeek));
        }).RequireAuthorization();

        api.MapPost("/auth/refresh", async (HttpContext ctx, AppDbContext db, JwtSettings jwt) =>
        {
            var deny = Authz.RequireHumanStaff(ctx);
            if (deny is not null) return deny;
            var user = await db.Users.FirstAsync(u => u.Id == Authz.Actor(ctx).Id);
            return Results.Ok(new { token = AuthSetup.IssueJwt(jwt, user), expiresInMinutes = 15 });
        }).RequireAuthorization();
    }

    private static void MapHome(RouteGroupBuilder api)
    {
        api.MapGet("/home", async (HttpContext ctx, AppDbContext db) =>
        {
            var deny = Authz.RequireStaff(ctx);
            if (deny is not null && !Authz.Actor(ctx).IsToken) return deny;
            await PurgeFlags(db);
            var week = ChicagoClock.WeekStart();
            var weekStartUtc = ChicagoClock.ToUtc(week.ToDateTime(TimeOnly.MinValue));
            var posts = await db.Posts.Include(p => p.CreatedBy).Include(p => p.Comments).ThenInclude(c => c.CreatedBy)
                .Where(p => p.WeekStart == week).OrderByDescending(p => p.CreatedAt).ToListAsync();
            var opens = await db.Flags.CountAsync(f => f.ArchivedAt == null);
            var punches = await db.Punches.Where(p => p.At >= weekStartUtc).ToListAsync();
            var openByUser = punches.GroupBy(p => p.UserId).Select(g => g.OrderByDescending(p => p.At).First()).Where(p => p.Dir == "in").ToList();
            var kudos = await db.Kudos.Include(k => k.ToUser).Include(k => k.FromUser).Where(k => k.WeekStart == week).ToListAsync();
            var top = kudos.GroupBy(k => k.ToUserId).Select(g => new
            {
                userId = g.Key,
                name = g.First().ToUser?.Name,
                initials = Maps.Initials(g.First().ToUser?.Name ?? ""),
                avatarColor = g.First().ToUser?.AvatarColor,
                stars = g.Count()
            }).OrderByDescending(x => x.stars).Take(3).ToList();
            var mentionStart = weekStartUtc;
            var mentionBars = await db.Mentions.Include(m => m.User).Where(m => m.CreatedAt >= mentionStart)
                .GroupBy(m => m.UserId)
                .Select(g => new { userId = g.Key, name = g.First().User!.Name, count = g.Count() })
                .OrderByDescending(x => x.count).Take(8).ToListAsync();
            var birthdays = await db.Users.Where(u => u.BirthdayInWindowOverride || u.Birthday != null).ToListAsync();
            var inWindow = birthdays.Where(u => u.BirthdayInWindowOverride || (u.Birthday is DateOnly b && ChicagoClock.InBirthdayWindow(b, ChicagoClock.Today)))
                .Select(u => new { u.Id, u.Name, initials = Maps.Initials(u.Name) }).ToList();
            var star = kudos.Where(k => k.FromUserId != Guid.Empty && k.ToUserId != Guid.Empty)
                .OrderByDescending(k => k.CreatedAt).FirstOrDefault();
            return Results.Ok(new
            {
                weekStart = week.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                weekEnd = ChicagoClock.WeekEnd(week).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                weekLabel = ChicagoClock.WeekLabel(),
                tz = "America/Chicago",
                stats = new
                {
                    wins = posts.Count(p => p.Kind == "win"),
                    onRoad = openByUser.Count(p => p.Workplace == "road"),
                    inOffice = openByUser.Count(p => p.Workplace == "office"),
                    openFlags = opens
                },
                posts = posts.Select(p => new
                {
                    p.Id, p.Kind, p.Title, p.Body, p.CreatedAt, p.WeekStart,
                    author = p.CreatedBy?.Name,
                    comments = p.Comments.OrderBy(c => c.CreatedAt).Select(c => new { c.Id, c.Body, author = c.CreatedBy?.Name, c.CreatedAt })
                }),
                starOfDay = star is null ? null : new { to = star.ToUser?.Name, body = star.Body, from = star.FromUserId },
                mentions = mentionBars,
                kudosTop = top,
                birthdays = inWindow
            });
        }).RequireAuthorization().WithTags("Home").Produces<HomeBoardDto>();
    }

    private static void MapClients(RouteGroupBuilder api)
    {
        api.MapGet("/clients", async (HttpContext ctx, AppDbContext db, string? industry, string? county, string? status, string? q, string? service, string? serviceId) =>
        {
            var deny = Authz.RequireStaff(ctx);
            if (deny is not null && !Authz.Actor(ctx).IsToken) return deny;
            var list = await db.Clients.Include(c => c.People).Include(c => c.Addresses)
                .Include(c => c.Services).ThenInclude(s => s.ServiceType)
                .AsNoTracking().ToListAsync();
            IEnumerable<Client> filtered = list;
            if (!string.IsNullOrWhiteSpace(industry)) filtered = filtered.Where(c => c.Industry == industry);
            if (!string.IsNullOrWhiteSpace(county)) filtered = filtered.Where(c => c.County == county);
            if (!string.IsNullOrWhiteSpace(status)) filtered = filtered.Where(c => c.Status == status);
            var serviceFilter = serviceId ?? service;
            if (!string.IsNullOrWhiteSpace(serviceFilter))
            {
                filtered = filtered.Where(c => c.Services.Any(s =>
                    s.On && (
                        string.Equals(s.ServiceType?.Name, serviceFilter, StringComparison.OrdinalIgnoreCase) ||
                        s.ServiceTypeId.ToString().Equals(serviceFilter, StringComparison.OrdinalIgnoreCase))));
            }
            if (!string.IsNullOrWhiteSpace(q))
                filtered = filtered.Where(c =>
                    c.Name.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                    c.People.Any(p => p.Name.Contains(q, StringComparison.OrdinalIgnoreCase)) ||
                    c.Addresses.Any(a => (a.Line1 ?? "").Contains(q, StringComparison.OrdinalIgnoreCase)));
            return Results.Ok(filtered.Select(c =>
            {
                var primary = c.People.FirstOrDefault(p => p.Primary) ?? c.People.FirstOrDefault();
                var addr = c.Addresses.FirstOrDefault(a => a.IsPrimary) ?? c.Addresses.FirstOrDefault();
                var fields = JsonUtil.ParseMap(c.CustomFieldsJson);
                string? contract = null;
                if (fields is not null && fields.TryGetValue("Contract end", out var ce)) contract = ce.ToString();
                return new
                {
                    c.Id, c.Name, c.Industry, c.Status, c.County,
                    primary = primary?.Name,
                    address = addr is null ? null : $"{addr.Line1}, {addr.City}, {addr.State}",
                    contractEnd = contract,
                    c.BusinessPhone, c.BusinessEmail, c.Website
                };
            }));
        }).RequireAuthorization().WithTags("Clients").Produces<IEnumerable<ClientListRowDto>>();

        api.MapPost("/clients", async (HttpContext ctx, ClientCreateRequest req, AppDbContext db, AuditWriter audit) =>
        {
            var deny = Authz.RequireHumanStaff(ctx);
            if (deny is not null) return deny;
            var c = new Client
            {
                Id = Guid.NewGuid(),
                Name = req.Name,
                Industry = req.Industry,
                Status = req.Status ?? "Active",
                County = req.County,
                BusinessPhone = req.BusinessPhone,
                BusinessEmail = req.BusinessEmail,
                Website = req.Website,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                UpdatedById = Authz.Actor(ctx).Id
            };
            db.Clients.Add(c);
            await db.SaveChangesAsync();
            await audit.WriteAsync(Authz.Actor(ctx).Id, "create", "client", c.Id, c.Id, null, new { c.Name }, null);
            return Results.Ok(new { c.Id });
        }).RequireAuthorization().WithTags("Clients").Produces<CreatedIdDto>();

        api.MapGet("/clients/{id:guid}", async (HttpContext ctx, Guid id, AppDbContext db) =>
        {
            var deny = Authz.RequireStaff(ctx);
            if (deny is not null && !Authz.Actor(ctx).IsToken) return deny;
            await PurgeFlags(db);
            var c = await LoadClient(db, id);
            if (c is null) return Results.NotFound();
            return Results.Ok(ClientFile(c, includeVaultMasked: true, includeCareFlags: true));
        }).RequireAuthorization().WithTags("Clients").Produces<ClientFileDto>();

        api.MapGet("/clients/{id:guid}/print", async (HttpContext ctx, Guid id, AppDbContext db) =>
        {
            var deny = Authz.RequireHumanStaff(ctx);
            if (deny is not null) return deny;
            var c = await LoadClient(db, id);
            if (c is null) return Results.NotFound();
            var dto = ClientFile(c, includeVaultMasked: false, includeCareFlags: false, print: true);
            return Results.Ok(dto);
        }).RequireAuthorization().WithTags("Clients").Produces<ClientFileDto>();

        api.MapPost("/clients/{id:guid}/people", async (HttpContext ctx, Guid id, PersonWriteRequest req, AppDbContext db, AuditWriter audit) =>
        {
            var deny = Authz.RequireHumanStaff(ctx);
            if (deny is not null) return deny;
            if (!await db.Clients.AnyAsync(c => c.Id == id)) return Results.NotFound();
            var p = new Person
            {
                Id = Guid.NewGuid(), ClientId = id, Name = req.Name, Title = req.Title, Department = req.Department,
                Email = req.Email, Phone = req.Phone, Pinned = req.Pinned, Primary = req.Primary
            };
            db.People.Add(p);
            if (req.Primary)
            {
                var others = await db.People.Where(x => x.ClientId == id).ToListAsync();
                foreach (var o in others) o.Primary = false;
                var client = await db.Clients.FirstAsync(c => c.Id == id);
                client.PrimaryPersonId = p.Id;
            }
            await db.SaveChangesAsync();
            await audit.WriteAsync(Authz.Actor(ctx).Id, "create", "person", p.Id, id, null, new { p.Name, p.Email, p.Phone }, null);
            return Results.Ok(new { p.Id });
        }).RequireAuthorization();

        api.MapPost("/clients/{id:guid}/addresses", async (HttpContext ctx, Guid id, AddressWriteRequest req, AppDbContext db, AuditWriter audit) =>
        {
            var deny = Authz.RequireHumanStaff(ctx);
            if (deny is not null) return deny;
            var a = new Address
            {
                Id = Guid.NewGuid(), ClientId = id, Label = req.Label, Line1 = req.Line1, City = req.City,
                State = req.State, Zip = req.Zip, County = req.County, Hours = req.Hours, IsPrimary = req.IsPrimary, Phone = req.Phone
            };
            db.Addresses.Add(a);
            await db.SaveChangesAsync();
            await audit.WriteAsync(Authz.Actor(ctx).Id, "create", "address", a.Id, id, null, new { a.Label, a.Line1 }, null);
            return Results.Ok(new { a.Id });
        }).RequireAuthorization();

        api.MapPost("/clients/{id:guid}/notes", async (HttpContext ctx, Guid id, CommentCreateRequest req, AppDbContext db, AuditWriter audit, MentionService mentions) =>
        {
            var deny = Authz.RequireHumanStaff(ctx);
            if (deny is not null) return deny;
            var n = new Note { Id = Guid.NewGuid(), ClientId = id, Body = req.Body, CreatedById = Authz.Actor(ctx).Id!.Value, CreatedAt = DateTime.UtcNow };
            db.Notes.Add(n);
            await db.SaveChangesAsync();
            await mentions.CaptureAsync(db, req.Body, "note", n.Id, n.CreatedById, default);
            await audit.WriteAsync(n.CreatedById, "create", "note", n.Id, id, null, new { body = req.Body }, null);
            return Results.Ok(new { n.Id });
        }).RequireAuthorization();

        api.MapGet("/clients/{id:guid}/vault", async (HttpContext ctx, Guid id, AppDbContext db) =>
        {
            if (Authz.DenyTokenForVaultOrAdmin(ctx) is { } d) return d;
            var deny = Authz.RequireHumanStaff(ctx);
            if (deny is not null) return deny;
            var items = await db.Credentials.Where(c => c.ClientId == id).ToListAsync();
            return Results.Ok(items.Select(Maps.VaultMasked));
        }).RequireAuthorization().WithTags("Clients").Produces<IEnumerable<VaultMaskedDto>>();

        api.MapPost("/clients/{id:guid}/vault", async (HttpContext ctx, Guid id, VaultWriteRequest req, AppDbContext db, VaultCrypto vault, AuditWriter audit) =>
        {
            if (Authz.DenyTokenForVaultOrAdmin(ctx) is { } d) return d;
            var deny = Authz.RequireHumanStaff(ctx);
            if (deny is not null) return deny;
            var (iv, cipher) = vault.Encrypt(req.Secret);
            var cred = new Credential
            {
                Id = Guid.NewGuid(), ClientId = id, Department = req.Department, Title = req.Title,
                Username = req.Username, SecretIv = iv, SecretCipher = cipher, Url = req.Url, Note = req.Note
            };
            db.Credentials.Add(cred);
            await db.SaveChangesAsync();
            await audit.WriteAsync(Authz.Actor(ctx).Id, "create", "credential", cred.Id, id, null, new { cred.Title, cred.Username, cred.Department }, null);
            return Results.Ok(Maps.VaultMasked(cred));
        }).RequireAuthorization().WithTags("Clients").Produces<VaultMaskedDto>();

        api.MapPost("/clients/{id:guid}/vault/{credId:guid}/reveal", async (HttpContext ctx, Guid id, Guid credId, AppDbContext db, VaultCrypto vault, AuditWriter audit) =>
        {
            if (Authz.DenyTokenForVaultOrAdmin(ctx) is { } d) return d;
            var deny = Authz.RequireHumanStaff(ctx);
            if (deny is not null) return deny;
            var cred = await db.Credentials.FirstOrDefaultAsync(c => c.Id == credId && c.ClientId == id);
            if (cred is null) return Results.NotFound();
            var secret = vault.Decrypt(cred.SecretIv, cred.SecretCipher);
            await audit.WriteAsync(Authz.Actor(ctx).Id, "reveal", "credential", cred.Id, id, null, new { cred.Title, revealed = true }, null);
            return Results.Ok(new { secret });
        }).RequireAuthorization().WithTags("Clients");
    }

    private static void MapFlags(RouteGroupBuilder api)
    {
        api.MapGet("/flags", async (HttpContext ctx, AppDbContext db, string? state, Guid? clientId, Guid? levelId) =>
        {
            var deny = Authz.RequireStaff(ctx);
            if (deny is not null && !Authz.Actor(ctx).IsToken) return deny;
            await PurgeFlags(db);
            var archived = string.Equals(state, "archived", StringComparison.OrdinalIgnoreCase);
            var q = db.Flags.Include(f => f.Level).Include(f => f.Client).Include(f => f.Person).Include(f => f.CreatedBy).AsQueryable();
            q = archived ? q.Where(f => f.ArchivedAt != null) : q.Where(f => f.ArchivedAt == null);
            if (clientId is Guid cid) q = q.Where(f => f.ClientId == cid);
            if (levelId is Guid lid) q = q.Where(f => f.LevelId == lid);
            var rows = await q.OrderByDescending(f => f.CreatedAt).ToListAsync();
            return Results.Ok(rows.Select(f => new
            {
                f.Id, f.Body, f.CreatedAt, f.ArchivedAt, f.PurgeAt,
                daysLeft = f.PurgeAt is DateTime p ? Math.Max(0, (int)(p - DateTime.UtcNow).TotalDays) : (int?)null,
                level = f.Level?.Name, color = f.Level?.Color,
                on = f.Person?.Name ?? "Account",
                clientId = f.ClientId, client = f.Client?.Name,
                createdById = f.CreatedById, createdBy = f.CreatedBy?.Name
            }));
        }).RequireAuthorization().WithTags("Flags").Produces<IEnumerable<FlagRowDto>>();

        api.MapPost("/flags", async (HttpContext ctx, FlagCreateRequest req, AppDbContext db, AuditWriter audit, MentionService mentions) =>
        {
            var deny = Authz.RequireHumanStaff(ctx);
            if (deny is not null) return deny;
            var f = new Flag
            {
                Id = Guid.NewGuid(), ClientId = req.ClientId, LevelId = req.LevelId, PersonId = req.PersonId,
                Body = req.Body, CreatedById = Authz.Actor(ctx).Id!.Value, CreatedAt = DateTime.UtcNow
            };
            db.Flags.Add(f);
            await db.SaveChangesAsync();
            await mentions.CaptureAsync(db, req.Body, "flag", f.Id, f.CreatedById, default);
            await audit.WriteAsync(f.CreatedById, "create", "flag", f.Id, f.ClientId, null, new { f.Body, f.LevelId }, null);
            return Results.Ok(new { f.Id });
        }).RequireAuthorization().WithTags("Flags").Produces<CreatedIdDto>();

        api.MapPost("/flags/{id:guid}/archive", async (HttpContext ctx, Guid id, AppDbContext db, AuditWriter audit) =>
        {
            var deny = Authz.RequireHumanStaff(ctx);
            if (deny is not null) return deny;
            var f = await db.Flags.FirstOrDefaultAsync(x => x.Id == id);
            if (f is null) return Results.NotFound();
            f.ArchivedAt = DateTime.UtcNow;
            f.PurgeAt = DateTime.UtcNow.AddDays(90);
            await db.SaveChangesAsync();
            await audit.WriteAsync(Authz.Actor(ctx).Id, "archive", "flag", f.Id, f.ClientId, null, new { f.PurgeAt }, null);
            return Results.Ok(new { f.Id, f.PurgeAt });
        }).RequireAuthorization().WithTags("Flags");

        api.MapPost("/flags/{id:guid}/restore", async (HttpContext ctx, Guid id, AppDbContext db, AuditWriter audit) =>
        {
            var deny = Authz.RequireHumanStaff(ctx);
            if (deny is not null) return deny;
            var f = await db.Flags.FirstOrDefaultAsync(x => x.Id == id);
            if (f is null) return Results.NotFound();
            if (f.ArchivedAt is null) return Results.BadRequest(new { error = "Flag is not archived." });
            if (f.PurgeAt is DateTime p && p <= DateTime.UtcNow) return Results.BadRequest(new { error = "Hold expired — flag was purged." });
            f.ArchivedAt = null;
            f.PurgeAt = null;
            await db.SaveChangesAsync();
            await audit.WriteAsync(Authz.Actor(ctx).Id, "restore", "flag", f.Id, f.ClientId, null, new { restored = true }, null);
            return Results.Ok(new { f.Id });
        }).RequireAuthorization().WithTags("Flags").Produces<CreatedIdDto>();
    }

    private static void MapTeam(RouteGroupBuilder api)
    {
        api.MapGet("/team", async (HttpContext ctx, AppDbContext db) =>
        {
            var deny = Authz.RequireStaff(ctx);
            if (deny is not null && !Authz.Actor(ctx).IsToken) return deny;
            var users = await db.Users.Include(u => u.Department).Include(u => u.Manager).OrderBy(u => u.Name).ToListAsync();
            var result = new List<object>();
            foreach (var u in users)
            {
                var open = await OpenPunch(db, u.Id);
                result.Add(Maps.UserCard(u, open, 0, 0, 0));
            }
            return Results.Ok(result);
        }).RequireAuthorization();

        api.MapGet("/team/{id:guid}", async (HttpContext ctx, Guid id, AppDbContext db) =>
        {
            var deny = Authz.RequireStaff(ctx);
            if (deny is not null && !Authz.Actor(ctx).IsToken) return deny;
            var u = await db.Users.Include(x => x.Department).Include(x => x.Manager).FirstOrDefaultAsync(x => x.Id == id);
            if (u is null) return Results.NotFound();
            var open = await OpenPunch(db, u.Id);
            var week = ChicagoClock.WeekStart();
            var month = ChicagoClock.MonthStart;
            var kudosWeek = await db.Kudos.CountAsync(k => k.ToUserId == u.Id && k.WeekStart == week);
            var kudosMonth = await db.Kudos.CountAsync(k => k.ToUserId == u.Id && k.WeekStart >= month);
            var mentionsWeek = await db.Mentions.CountAsync(m => m.UserId == u.Id && m.CreatedAt >= ChicagoClock.ToUtc(week.ToDateTime(TimeOnly.MinValue)));
            return Results.Ok(Maps.UserCard(u, open, kudosWeek, kudosMonth, mentionsWeek));
        }).RequireAuthorization();

        api.MapGet("/me", async (HttpContext ctx, AppDbContext db) =>
        {
            var deny = Authz.RequireHumanStaff(ctx);
            if (deny is not null) return deny;
            ctx.Request.RouteValues["id"] = Authz.Actor(ctx).Id;
            var u = await db.Users.Include(x => x.Department).Include(x => x.Manager).FirstAsync(x => x.Id == Authz.Actor(ctx).Id);
            var open = await OpenPunch(db, u.Id);
            return Results.Ok(Maps.UserCard(u, open, 0, 0, 0));
        }).RequireAuthorization();

        api.MapPut("/me", async (HttpContext ctx, ProfileUpdateRequest req, AppDbContext db, AuditWriter audit) =>
        {
            var deny = Authz.RequireHumanStaff(ctx);
            if (deny is not null) return deny;
            var u = await db.Users.FirstAsync(x => x.Id == Authz.Actor(ctx).Id);
            var before = new { u.Name, u.PhoneMobile, u.PhoneWork, u.Ext };
            if (req.Name is not null) u.Name = req.Name;
            if (req.PhoneMobile is not null) u.PhoneMobile = req.PhoneMobile;
            if (req.PhoneWork is not null) u.PhoneWork = req.PhoneWork;
            if (req.Ext is not null) u.Ext = req.Ext;
            await db.SaveChangesAsync();
            await audit.WriteAsync(u.Id, "edit", "user", u.Id, null, before, new { u.Name, u.PhoneMobile, u.PhoneWork, u.Ext }, null);
            return Results.Ok(Maps.UserCard(u, await OpenPunch(db, u.Id), 0, 0, 0));
        }).RequireAuthorization();

        api.MapGet("/presence", async (HttpContext ctx, AppDbContext db) =>
        {
            var deny = Authz.RequireStaff(ctx);
            if (deny is not null && !Authz.Actor(ctx).IsToken) return deny;
            var users = await db.Users.ToListAsync();
            var list = new List<object>();
            foreach (var u in users)
            {
                var open = await OpenPunch(db, u.Id);
                list.Add(new { u.Id, u.Name, presence = Maps.Presence(open), signedIn = u.LastActiveAt is DateTime t && t > DateTime.UtcNow.AddMinutes(-20) });
            }
            return Results.Ok(list);
        }).RequireAuthorization();
    }

    private static void MapTime(RouteGroupBuilder api)
    {
        api.MapGet("/time", async (HttpContext ctx, AppDbContext db, Guid? userId) =>
        {
            var deny = Authz.RequireHumanStaff(ctx);
            if (deny is not null) return deny;
            var actor = Authz.Actor(ctx);
            var uid = actor.IsAdmin && userId is Guid g ? g : actor.Id!.Value;
            var rows = await db.Punches.Where(p => p.UserId == uid).OrderByDescending(p => p.At).Take(200).ToListAsync();
            var open = rows.FirstOrDefault();
            if (open is { Dir: "out" }) open = null;
            else if (open is { Dir: "in" }) { }
            var weekStart = ChicagoClock.ToUtc(ChicagoClock.WeekStart().ToDateTime(TimeOnly.MinValue));
            var todayStart = ChicagoClock.ToUtc(ChicagoClock.Today.ToDateTime(TimeOnly.MinValue));
            return Results.Ok(new
            {
                open = await OpenPunch(db, uid),
                todayHours = Hours(rows.Where(p => p.At >= todayStart).ToList()),
                weekHours = Hours(rows.Where(p => p.At >= weekStart).ToList()),
                punches = rows.Select(p => new { p.Id, p.Dir, p.Workplace, p.Destination, p.At, p.Note, p.EditedFrom })
            });
        }).RequireAuthorization();

        api.MapPost("/time/clock", async (HttpContext ctx, PunchClockRequest req, AppDbContext db, AuditWriter audit) =>
        {
            var deny = Authz.RequireHumanStaff(ctx);
            if (deny is not null) return deny;
            var uid = Authz.Actor(ctx).Id!.Value;
            var open = await OpenPunch(db, uid);
            var dir = (req.Dir ?? (open is { Dir: "in" } ? "out" : "in")).ToLowerInvariant();
            var place = (req.Workplace ?? open?.Workplace ?? "office").ToLowerInvariant();
            if (dir == "in" && place == "road" && string.IsNullOrWhiteSpace(req.Destination))
                return Results.BadRequest(new { error = "Road clock-in needs a destination." });
            var punch = new Punch
            {
                Id = Guid.NewGuid(), UserId = uid, Dir = dir, Workplace = place,
                Destination = req.Destination, At = DateTime.UtcNow
            };
            db.Punches.Add(punch);
            await db.SaveChangesAsync();
            await audit.WriteAsync(uid, dir == "in" ? "clock-in" : "clock-out", "punch", punch.Id, null, null, new { place, punch.Destination }, null);
            return Results.Ok(new { punch.Id, punch.Dir, punch.Workplace, punch.Destination, punch.At });
        }).RequireAuthorization();

        api.MapPut("/time/{id:guid}", async (HttpContext ctx, Guid id, PunchEditRequest req, AppDbContext db, AuditWriter audit) =>
        {
            var deny = Authz.RequireHumanStaff(ctx);
            if (deny is not null) return deny;
            var actor = Authz.Actor(ctx);
            var punch = await db.Punches.Include(p => p.User).FirstOrDefaultAsync(p => p.Id == id);
            if (punch is null) return Results.NotFound();
            if (!actor.IsAdmin && punch.UserId != actor.Id) return Results.Json(new { error = "You can only edit your punches." }, statusCode: 403);
            var before = new { punch.At, punch.Note };
            var edited = new Punch
            {
                Id = Guid.NewGuid(),
                UserId = punch.UserId,
                Dir = punch.Dir,
                Workplace = punch.Workplace,
                Destination = punch.Destination,
                At = req.At.Kind == DateTimeKind.Utc ? req.At : ChicagoClock.ToUtc(req.At),
                Note = req.Note ?? punch.Note,
                EditedFrom = punch.Id,
                EditedById = actor.Id
            };
            // Keep original row (not erased) and add corrected punch; hide original from default list by marking note
            punch.Note = string.IsNullOrWhiteSpace(punch.Note) ? "superseded" : punch.Note + " · superseded";
            db.Punches.Add(edited);
            await db.SaveChangesAsync();
            await audit.WriteAsync(actor.Id, "edit", "punch", edited.Id, null, before, new { edited.At, edited.Note }, req.Reason);
            return Results.Ok(new { edited.Id, managerNotified = punch.User?.ManagerId });
        }).RequireAuthorization();
    }

    private static void MapReports(RouteGroupBuilder api)
    {
        api.MapGet("/export/{kind}", (HttpContext ctx, string kind) =>
        {
            var deny = Authz.RequireAdmin(ctx);
            return deny ?? Results.Redirect($"/api/admin/export/{kind}");
        }).RequireAuthorization();

        api.MapGet("/reports", async (HttpContext ctx, AppDbContext db) =>
        {
            var deny = Authz.RequireAdmin(ctx);
            if (deny is not null) return deny;
            var weekStart = ChicagoClock.ToUtc(ChicagoClock.WeekStart().ToDateTime(TimeOnly.MinValue));
            var punches = await db.Punches.Include(p => p.User).ThenInclude(u => u!.Department)
                .Where(p => p.At >= weekStart && (p.Note == null || !p.Note.Contains("superseded")))
                .OrderByDescending(p => p.At).ToListAsync();
            var byUser = punches.GroupBy(p => p.UserId).Select(g =>
            {
                var u = g.First().User!;
                var hours = HoursByPlace(g.ToList());
                return new
                {
                    userId = u.Id,
                    name = u.Name,
                    dept = u.Department?.Name,
                    office = hours.GetValueOrDefault("office"),
                    road = hours.GetValueOrDefault("road"),
                    home = hours.GetValueOrDefault("home"),
                    total = hours.Values.Sum()
                };
            }).OrderBy(x => x.name).ToList();
            return Results.Ok(new
            {
                weekStart = ChicagoClock.WeekStart(),
                totals = new
                {
                    hours = byUser.Sum(x => x.total),
                    office = byUser.Sum(x => x.office),
                    road = byUser.Sum(x => x.road),
                    home = byUser.Sum(x => x.home)
                },
                byPerson = byUser,
                punches = punches.Take(80).Select(p => new { who = p.User?.Name, p.At, p.Dir, p.Workplace, p.Destination, p.Note })
            });
        }).RequireAuthorization();
    }

    private static void MapAudit(RouteGroupBuilder api)
    {
        api.MapGet("/audit", async (HttpContext ctx, AppDbContext db, string? action, Guid? actorId, Guid? clientId) =>
        {
            var deny = Authz.RequireAdmin(ctx);
            if (deny is not null) return deny;
            var q = db.Audits.Include(a => a.Actor).AsQueryable();
            if (!string.IsNullOrWhiteSpace(action)) q = q.Where(a => a.Action == action);
            if (actorId is Guid aid) q = q.Where(a => a.ActorId == aid);
            if (clientId is Guid cid) q = q.Where(a => a.ClientId == cid);
            var rows = await q.OrderByDescending(a => a.CreatedAt).Take(300).ToListAsync();
            return Results.Ok(rows.Select(a => new
            {
                a.Id, a.Action, a.ObjectType, a.ObjectId, a.ClientId, a.Reason, a.CreatedAt,
                actor = a.Actor?.Name,
                before = a.BeforeJson,
                after = a.AfterJson,
                canRevert = (a.Action is "edit" or "archive") && a.ObjectType is not ("punch" or "credential")
            }));
        }).RequireAuthorization();

        api.MapPost("/audit/{id:guid}/revert", async (HttpContext ctx, Guid id, RevertRequest req, AppDbContext db, AuditWriter audit) =>
        {
            var deny = Authz.RequireAdmin(ctx);
            if (deny is not null) return deny;
            var row = await db.Audits.AsNoTracking().FirstOrDefaultAsync(a => a.Id == id);
            if (row is null) return Results.NotFound();
            if (row.ObjectType == "flag" && row.Action == "archive" && row.ObjectId is Guid fid)
            {
                var f = await db.Flags.FirstOrDefaultAsync(x => x.Id == fid);
                if (f is not null) { f.ArchivedAt = null; f.PurgeAt = null; }
            }
            if (row.ObjectType == "person" && row.BeforeJson is not null && row.ObjectId is Guid pid)
            {
                var person = await db.People.FirstOrDefaultAsync(p => p.Id == pid);
                if (person is not null && JsonDocument.Parse(row.BeforeJson).RootElement.TryGetProperty("phone", out var ph))
                    person.Phone = ph.GetString();
            }
            await db.SaveChangesAsync();
            await audit.WriteAsync(Authz.Actor(ctx).Id, "revert", row.ObjectType, row.ObjectId, row.ClientId, row.AfterJson, row.BeforeJson, req.Reason ?? "revert");
            return Results.Ok(new { ok = true });
        }).RequireAuthorization();
    }

    private static void MapBoard(RouteGroupBuilder api)
    {
        api.MapPost("/posts", async (HttpContext ctx, PostCreateRequest req, AppDbContext db, AuditWriter audit, MentionService mentions) =>
        {
            var deny = Authz.RequireAdmin(ctx);
            if (deny is not null) return deny;
            var p = new Post
            {
                Id = Guid.NewGuid(), Kind = req.Kind, Title = req.Title, Body = req.Body,
                CreatedById = Authz.Actor(ctx).Id!.Value, CreatedAt = DateTime.UtcNow, WeekStart = ChicagoClock.WeekStart()
            };
            db.Posts.Add(p);
            await db.SaveChangesAsync();
            await mentions.CaptureAsync(db, $"{req.Title} {req.Body}", "post", p.Id, p.CreatedById, default);
            await audit.WriteAsync(p.CreatedById, "create", "post", p.Id, null, null, new { p.Kind, p.Title }, null);
            return Results.Ok(new { p.Id });
        }).RequireAuthorization();

        api.MapPost("/posts/{id:guid}/comments", async (HttpContext ctx, Guid id, CommentCreateRequest req, AppDbContext db, MentionService mentions) =>
        {
            var deny = Authz.RequireHumanStaff(ctx);
            if (deny is not null) return deny;
            var c = new Comment { Id = Guid.NewGuid(), PostId = id, Body = req.Body, CreatedById = Authz.Actor(ctx).Id!.Value, CreatedAt = DateTime.UtcNow };
            db.Comments.Add(c);
            await db.SaveChangesAsync();
            await mentions.CaptureAsync(db, req.Body, "comment", c.Id, c.CreatedById, default);
            return Results.Ok(new { c.Id });
        }).RequireAuthorization();

        api.MapGet("/stickies", async (HttpContext ctx, AppDbContext db) =>
        {
            var deny = Authz.RequireStaff(ctx);
            if (deny is not null && !Authz.Actor(ctx).IsToken) return deny;
            var rows = await db.Stickies.Include(s => s.PinnedUser).Include(s => s.CreatedBy).ToListAsync();
            return Results.Ok(rows.Select(s => new
            {
                s.Id, s.X, s.Y, s.Color, s.Text, s.DrawBlob,
                pinnedUserId = s.PinnedUserId, pinned = s.PinnedUser?.Name ?? "Shop",
                createdBy = s.CreatedBy?.Name
            }));
        }).RequireAuthorization();

        api.MapPost("/stickies", async (HttpContext ctx, StickyCreateRequest req, AppDbContext db, MentionService mentions) =>
        {
            var deny = Authz.RequireHumanStaff(ctx);
            if (deny is not null) return deny;
            var s = new Sticky
            {
                Id = Guid.NewGuid(), X = req.X, Y = req.Y, Color = req.Color, Text = req.Text,
                PinnedUserId = req.PinnedUserId, CreatedById = Authz.Actor(ctx).Id!.Value, CreatedAt = DateTime.UtcNow
            };
            db.Stickies.Add(s);
            await db.SaveChangesAsync();
            await mentions.CaptureAsync(db, req.Text, "sticky", s.Id, s.CreatedById, default);
            return Results.Ok(new { s.Id });
        }).RequireAuthorization();

        api.MapPut("/stickies/{id:guid}", async (HttpContext ctx, Guid id, StickyMoveRequest req, AppDbContext db) =>
        {
            var deny = Authz.RequireHumanStaff(ctx);
            if (deny is not null) return deny;
            var s = await db.Stickies.FirstOrDefaultAsync(x => x.Id == id);
            if (s is null) return Results.NotFound();
            s.X = req.X; s.Y = req.Y;
            if (req.Text is not null) s.Text = req.Text;
            if (req.PinnedUserId is not null) s.PinnedUserId = req.PinnedUserId;
            await db.SaveChangesAsync();
            return Results.Ok(new { s.Id, s.X, s.Y });
        }).RequireAuthorization();

        api.MapDelete("/stickies/{id:guid}", async (HttpContext ctx, Guid id, AppDbContext db) =>
        {
            var deny = Authz.RequireHumanStaff(ctx);
            if (deny is not null) return deny;
            var s = await db.Stickies.FirstOrDefaultAsync(x => x.Id == id);
            if (s is null) return Results.NotFound();
            db.Stickies.Remove(s);
            await db.SaveChangesAsync();
            return Results.Ok();
        }).RequireAuthorization();

        api.MapPost("/stickies/{id:guid}/draw", async (HttpContext ctx, Guid id, AppDbContext db) =>
        {
            var deny = Authz.RequireHumanStaff(ctx);
            if (deny is not null) return deny;
            var s = await db.Stickies.FirstOrDefaultAsync(x => x.Id == id);
            if (s is null) return Results.NotFound();
            using var ms = new MemoryStream();
            await ctx.Request.Body.CopyToAsync(ms);
            s.DrawBlob = Convert.ToBase64String(ms.ToArray());
            await db.SaveChangesAsync();
            return Results.Ok(new { s.Id });
        }).RequireAuthorization();
    }

    private static void MapKudos(RouteGroupBuilder api)
    {
        api.MapGet("/kudos", async (HttpContext ctx, AppDbContext db) =>
        {
            var deny = Authz.RequireStaff(ctx);
            if (deny is not null && !Authz.Actor(ctx).IsToken) return deny;
            var week = ChicagoClock.WeekStart();
            var month = ChicagoClock.MonthStart;
            var all = await db.Kudos.Include(k => k.ToUser).Include(k => k.FromUser).OrderByDescending(k => k.CreatedAt).ToListAsync();
            var users = await db.Users.ToListAsync();
            var weekRows = all.Where(k => k.WeekStart == week).ToList();
            var totals = users.Select(u => new
            {
                u.Id, u.Name, initials = Maps.Initials(u.Name), avatarColor = u.AvatarColor,
                week = weekRows.Count(k => k.ToUserId == u.Id),
                month = all.Count(k => k.ToUserId == u.Id && k.WeekStart >= month)
            }).OrderByDescending(x => x.week).ThenByDescending(x => x.month);
            return Results.Ok(new
            {
                weekStart = week,
                latest = weekRows.Select(k => new { k.Id, k.Body, k.CreatedAt, from = k.FromUser?.Name, to = k.ToUser?.Name }),
                totals
            });
        }).RequireAuthorization();

        api.MapPost("/kudos", async (HttpContext ctx, KudosCreateRequest req, AppDbContext db, AuditWriter audit, MentionService mentions) =>
        {
            var deny = Authz.RequireHumanStaff(ctx);
            if (deny is not null) return deny;
            if (string.IsNullOrWhiteSpace(req.Body)) return Results.BadRequest(new { error = "Name the thing they did." });
            var k = new Kudos
            {
                Id = Guid.NewGuid(), ToUserId = req.ToUserId, FromUserId = Authz.Actor(ctx).Id!.Value,
                Body = req.Body.Trim(), WeekStart = ChicagoClock.WeekStart(), CreatedAt = DateTime.UtcNow
            };
            db.Kudos.Add(k);
            await db.SaveChangesAsync();
            await mentions.CaptureAsync(db, req.Body, "kudos", k.Id, k.FromUserId, default);
            await audit.WriteAsync(k.FromUserId, "create", "kudos", k.Id, null, null, new { k.ToUserId, k.Body }, null);
            return Results.Ok(new { k.Id, stars = 1 });
        }).RequireAuthorization();
    }

    private static void MapMentions(RouteGroupBuilder api)
    {
        api.MapGet("/mentions", async (HttpContext ctx, AppDbContext db) =>
        {
            var deny = Authz.RequireHumanStaff(ctx);
            if (deny is not null) return deny;
            var uid = Authz.Actor(ctx).Id!.Value;
            var rows = await db.Mentions.Where(m => m.UserId == uid).OrderByDescending(m => m.CreatedAt).Take(100).ToListAsync();
            return Results.Ok(rows.Select(m => new { m.Id, m.SourceType, m.SourceId, m.Snippet, m.CreatedAt }));
        }).RequireAuthorization();
    }

    private static void MapAdmin(RouteGroupBuilder api)
    {
        var admin = api.MapGroup("/admin").AddEndpointFilter(async (ctx, next) =>
        {
            if (Authz.RequireAdmin(ctx.HttpContext) is { } deny) return deny;
            if (Authz.DenyTokenForVaultOrAdmin(ctx.HttpContext) is { } d2) return d2;
            return await next(ctx);
        });

        admin.MapGet("/users", async (AppDbContext db) =>
        {
            var users = await db.Users.Include(u => u.Department).Include(u => u.Manager).ToListAsync();
            var list = new List<object>();
            foreach (var u in users)
                list.Add(Maps.UserCard(u, await OpenPunch(db, u.Id), 0, 0, 0));
            return Results.Ok(list);
        });

        admin.MapPost("/users", async (HttpContext ctx, UserCreateRequest req, AppDbContext db, AuditWriter audit) =>
        {
            if (req.Role is not (Roles.Staff or Roles.Admin)) return Results.BadRequest(new { error = "Role must be staff or admin." });
            var u = new User
            {
                Id = Guid.NewGuid(), Name = req.Name, Email = req.Email.Trim().ToLowerInvariant(),
                Role = req.Role, DepartmentId = req.DepartmentId, ManagerId = req.ManagerId,
                PhoneMobile = req.PhoneMobile, PhoneWork = req.PhoneWork ?? "(940) 555-0100", Ext = req.Ext, Title = req.Title,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(string.IsNullOrWhiteSpace(req.Password) ? SeedData.SeedPassword : req.Password),
                CreatedAt = DateTime.UtcNow
            };
            db.Users.Add(u);
            await db.SaveChangesAsync();
            await audit.WriteAsync(Authz.Actor(ctx).Id, "create", "user", u.Id, null, null, new { u.Email, u.Role }, null);
            return Results.Ok(new { u.Id });
        });

        admin.MapGet("/departments", async (AppDbContext db) => Results.Ok(await db.Departments.OrderBy(d => d.Name).ToListAsync()));
        admin.MapPost("/departments", async (HttpContext ctx, NamedRequest req, AppDbContext db, AuditWriter audit) =>
        {
            var d = new Department { Id = Guid.NewGuid(), Name = req.Name };
            db.Departments.Add(d);
            await db.SaveChangesAsync();
            await audit.WriteAsync(Authz.Actor(ctx).Id, "create", "department", d.Id, null, null, new { d.Name }, null);
            return Results.Ok(d);
        });

        admin.MapGet("/services", async (AppDbContext db) => Results.Ok(await db.ServiceTypes.OrderBy(s => s.Name).ToListAsync()));
        admin.MapPost("/services", async (NamedRequest req, AppDbContext db) =>
        {
            var s = new ServiceType { Id = Guid.NewGuid(), Name = req.Name, Description = req.Description };
            db.ServiceTypes.Add(s);
            await db.SaveChangesAsync();
            return Results.Ok(s);
        });

        admin.MapGet("/flag-levels", async (AppDbContext db) => Results.Ok(await db.FlagLevels.ToListAsync()));
        admin.MapPost("/flag-levels", async (NamedRequest req, AppDbContext db) =>
        {
            var l = new FlagLevel { Id = Guid.NewGuid(), Name = req.Name, Color = req.Color ?? "note", Description = req.Description };
            db.FlagLevels.Add(l);
            await db.SaveChangesAsync();
            return Results.Ok(l);
        });

        admin.MapGet("/counties", async (AppDbContext db) => Results.Ok(await db.Counties.OrderBy(c => c.Name).ToListAsync()));
        admin.MapPost("/counties", async (NamedRequest req, AppDbContext db) =>
        {
            var c = new County { Id = Guid.NewGuid(), Name = req.Name };
            db.Counties.Add(c);
            await db.SaveChangesAsync();
            return Results.Ok(c);
        });

        admin.MapGet("/settings", async (AppDbContext db, IConfiguration cfg) =>
        {
            var s = await db.CompanySettings.FirstAsync();
            return Results.Ok(new
            {
                s.CompanyName, s.ShowPresence, s.IdleMinutes, s.CompressPhotos, s.AllowDocuments, s.MaxUploadMb,
                ssoEnabled = string.Equals(cfg["SSO_ENABLED"], "true", StringComparison.OrdinalIgnoreCase),
                s.SsoProvider, s.GeofenceOffice, s.OfficeAddress, s.TimeZone
            });
        });

        admin.MapPut("/settings", async (HttpContext ctx, SettingWriteRequest req, AppDbContext db, AuditWriter audit) =>
        {
            var s = await db.CompanySettings.FirstAsync();
            if (req.CompanyName is not null) s.CompanyName = req.CompanyName;
            if (req.ShowPresence is bool p) s.ShowPresence = p;
            if (req.IdleMinutes is int m) s.IdleMinutes = m;
            if (req.GeofenceOffice is bool g) s.GeofenceOffice = g;
            await db.SaveChangesAsync();
            await audit.WriteAsync(Authz.Actor(ctx).Id, "edit", "settings", s.Id, null, null, new { s.CompanyName, s.IdleMinutes }, null);
            return Results.Ok(s);
        });

        admin.MapGet("/tokens", async (AppDbContext db) =>
        {
            var rows = await db.AccessTokens.OrderBy(t => t.Name).ToListAsync();
            return Results.Ok(rows.Select(t => new
            {
                t.Id, t.Name, t.Contact, t.Internal, t.Enabled, t.CreatedAt,
                token = string.IsNullOrEmpty(t.PrefixHint) ? (t.Enabled ? "adm_ext_••••••••" : "No token") : $"adm_ext_••••••••{t.PrefixHint}"
            }));
        });

        admin.MapPost("/tokens", async (HttpContext ctx, TokenCreateRequest req, AppDbContext db, AuditWriter audit) =>
        {
            var raw = TokenHash.NewAccessToken();
            var t = new AccessToken
            {
                Id = Guid.NewGuid(), Name = req.Name, Contact = req.Contact, Internal = req.Internal,
                Hash = TokenHash.Sha256(raw), PrefixHint = raw[^4..], Enabled = true, CreatedAt = DateTime.UtcNow
            };
            db.AccessTokens.Add(t);
            await db.SaveChangesAsync();
            await audit.WriteAsync(Authz.Actor(ctx).Id, "create", "accessToken", t.Id, null, null, new { t.Name, t.PrefixHint }, null);
            return Results.Ok(new { t.Id, token = raw, copyOnce = true });
        });

        admin.MapPost("/tokens/{id:guid}/regenerate", async (HttpContext ctx, Guid id, AppDbContext db, AuditWriter audit) =>
        {
            var t = await db.AccessTokens.FirstOrDefaultAsync(x => x.Id == id);
            if (t is null) return Results.NotFound();
            var raw = TokenHash.NewAccessToken();
            t.Hash = TokenHash.Sha256(raw);
            t.PrefixHint = raw[^4..];
            t.Enabled = true;
            await db.SaveChangesAsync();
            await audit.WriteAsync(Authz.Actor(ctx).Id, "regenerate", "accessToken", t.Id, null, null, new { t.Name }, null);
            return Results.Ok(new { t.Id, token = raw, copyOnce = true });
        });

        admin.MapGet("/export/{kind}", async (HttpContext ctx, string kind, AppDbContext db) =>
        {
            var deny = Authz.RequireAdmin(ctx);
            if (deny is not null) return deny;
            string csv;
            if (kind is "clients" or "clients-addresses")
            {
                var clients = await db.Clients.Include(c => c.Addresses).Include(c => c.People).AsNoTracking().ToListAsync();
                var sb = new StringBuilder();
                sb.AppendLine("Name,Status,Industry,County,BusinessPhone,BusinessEmail,Website,Primary,Address");
                foreach (var c in clients)
                {
                    var p = c.People.FirstOrDefault(x => x.Primary)?.Name;
                    var a = c.Addresses.FirstOrDefault(x => x.IsPrimary);
                    sb.AppendLine(string.Join(',', Csv(c.Name), Csv(c.Status), Csv(c.Industry), Csv(c.County), Csv(c.BusinessPhone), Csv(c.BusinessEmail), Csv(c.Website), Csv(p), Csv(a is null ? "" : $"{a.Line1} {a.City}")));
                }
                csv = sb.ToString();
            }
            else if (kind == "people")
            {
                var people = await db.People.Include(p => p.Client).AsNoTracking().ToListAsync();
                var sb = new StringBuilder();
                sb.AppendLine("Client,Name,Title,Department,Email,Phone");
                foreach (var p in people)
                    sb.AppendLine(string.Join(',', Csv(p.Client?.Name), Csv(p.Name), Csv(p.Title), Csv(p.Department), Csv(p.Email), Csv(p.Phone)));
                csv = sb.ToString();
            }
            else if (kind == "flags")
            {
                var flags = await db.Flags.Include(f => f.Client).Include(f => f.Level).AsNoTracking().ToListAsync();
                var sb = new StringBuilder();
                sb.AppendLine("Client,Level,Body,CreatedAt,ArchivedAt");
                foreach (var f in flags)
                    sb.AppendLine(string.Join(',', Csv(f.Client?.Name), Csv(f.Level?.Name), Csv(f.Body), f.CreatedAt.ToString("o"), f.ArchivedAt?.ToString("o")));
                csv = sb.ToString();
            }
            else if (kind == "audit")
            {
                var rows = await db.Audits.Include(a => a.Actor).AsNoTracking().OrderByDescending(a => a.CreatedAt).Take(2000).ToListAsync();
                var sb = new StringBuilder();
                sb.AppendLine("When,Actor,Action,Object,Before,After");
                foreach (var a in rows)
                    sb.AppendLine(string.Join(',', a.CreatedAt.ToString("o"), Csv(a.Actor?.Name), Csv(a.Action), Csv(a.ObjectType), Csv(a.BeforeJson), Csv(a.AfterJson)));
                csv = sb.ToString();
            }
            else return Results.BadRequest(new { error = "Unknown export" });
            if (csv.Contains("Secret", StringComparison.OrdinalIgnoreCase) && csv.Contains("Cipher"))
                return Results.StatusCode(500);
            return Results.File(Encoding.UTF8.GetBytes(csv), "text/csv", $"admin-{kind}.csv");
        });
    }

    private static void MapFiles(RouteGroupBuilder api)
    {
        api.MapPost("/clients/{id:guid}/files", async (HttpContext ctx, Guid id, AppDbContext db, FileStore store, AuditWriter audit) =>
        {
            var deny = Authz.RequireHumanStaff(ctx);
            if (deny is not null) return deny;
            var form = await ctx.Request.ReadFormAsync();
            var file = form.Files.FirstOrDefault();
            if (file is null) return Results.BadRequest(new { error = "No file" });
            if (file.Length > 25 * 1024 * 1024) return Results.BadRequest(new { error = "Max 25 MB" });
            await using var stream = file.OpenReadStream();
            var saved = await store.SaveAsync(stream, file.FileName, file.ContentType, compressImages: true, ctx.RequestAborted);
            var att = new Attachment
            {
                Id = Guid.NewGuid(), ClientId = id, Kind = file.ContentType.StartsWith("image/") ? "photo" : "file",
                Name = file.FileName, BlobKey = saved.Key, Mime = saved.Mime, Bytes = saved.Bytes, CreatedAt = DateTime.UtcNow
            };
            db.Attachments.Add(att);
            await db.SaveChangesAsync();
            await audit.WriteAsync(Authz.Actor(ctx).Id, "create", "attachment", att.Id, id, null, new { att.Name, att.Bytes, att.Mime }, null);
            return Results.Ok(new { att.Id, att.Name, att.Mime, att.Bytes, att.Kind });
        }).RequireAuthorization();

        api.MapGet("/files/{id:guid}", DownloadFile).RequireAuthorization();

        api.MapGet("/lookups", async (HttpContext ctx, AppDbContext db, IConfiguration cfg) =>
        {
            var deny = Authz.RequireStaff(ctx);
            if (deny is not null && !Authz.Actor(ctx).IsToken) return deny;
            return Results.Ok(new
            {
                departments = await db.Departments.OrderBy(d => d.Name).ToListAsync(),
                counties = await db.Counties.OrderBy(c => c.Name).Select(c => c.Name).ToListAsync(),
                services = await db.ServiceTypes.OrderBy(s => s.Name).ToListAsync(),
                flagLevels = await db.FlagLevels.ToListAsync(),
                customFields = await db.CustomFieldDefs.ToListAsync(),
                ssoEnabled = string.Equals(cfg["SSO_ENABLED"], "true", StringComparison.OrdinalIgnoreCase),
                product = "Admin"
            });
        }).RequireAuthorization();
    }

    private static async Task<Client?> LoadClient(AppDbContext db, Guid id) =>
        await db.Clients
            .Include(c => c.People)
            .Include(c => c.Addresses)
            .Include(c => c.Services).ThenInclude(s => s.ServiceType)
            .Include(c => c.Links)
            .Include(c => c.Vendors)
            .Include(c => c.Credentials)
            .Include(c => c.Flags).ThenInclude(f => f.Level)
            .Include(c => c.Flags).ThenInclude(f => f.Person)
            .Include(c => c.Flags).ThenInclude(f => f.CreatedBy)
            .Include(c => c.Attachments)
            .Include(c => c.Notes).ThenInclude(n => n.CreatedBy)
            .FirstOrDefaultAsync(c => c.Id == id);

    private static object ClientFile(Client c, bool includeVaultMasked, bool includeCareFlags, bool print = false)
    {
        var primary = c.People.FirstOrDefault(p => p.Primary) ?? c.People.FirstOrDefault();
        var addr = c.Addresses.FirstOrDefault(a => a.IsPrimary) ?? c.Addresses.FirstOrDefault();
        var flags = c.Flags.Where(f => f.ArchivedAt == null);
        if (!includeCareFlags) flags = flags.Where(f => f.Level?.Color != "care");
        var mapQuery = addr is null ? null : Uri.EscapeDataString($"{addr.Line1}, {addr.City}, {addr.State} {addr.Zip}");
        return new
        {
            c.Id, c.Name, c.Industry, c.Status, c.County,
            c.BusinessPhone, c.BusinessEmail, c.Website,
            business = new
            {
                call = c.BusinessPhone,
                email = c.BusinessEmail ?? primary?.Email,
                map = mapQuery is null ? null : $"https://www.google.com/maps/search/?api=1&query={mapQuery}",
                mapLabel = addr?.Label,
                website = c.Website
            },
            customFields = JsonUtil.ParseMap(c.CustomFieldsJson),
            people = c.People.Select(p => new { p.Id, p.Name, p.Title, p.Department, p.Email, p.Phone, p.Pinned, p.Primary, initials = Maps.Initials(p.Name), avatarColor = p.AvatarColor }),
            addresses = c.Addresses.Select(a => new
            {
                a.Id, a.Label, a.Line1, a.City, a.State, a.Zip, a.County, a.Hours, a.IsPrimary, a.Phone,
                maps = $"https://www.google.com/maps/search/?api=1&query={Uri.EscapeDataString($"{a.Line1}, {a.City}, {a.State} {a.Zip}")}"
            }),
            services = c.Services.Select(s => new { s.Id, name = s.ServiceType?.Name, s.On, s.Note }),
            links = c.Links.Select(l => new { l.Id, l.Label, l.Url }),
            vendors = c.Vendors.Select(v => new { v.Id, v.Kind, v.Name, v.Phone }),
            vault = includeVaultMasked && !print ? c.Credentials.Select(Maps.VaultMasked) : Array.Empty<object>(),
            flags = flags.OrderByDescending(f => f.CreatedAt).Select(f => new
            {
                f.Id, f.Body, f.CreatedAt, level = f.Level?.Name, color = f.Level?.Color,
                on = f.Person?.Name ?? "Account", createdBy = f.CreatedBy?.Name
            }),
            files = print ? Array.Empty<object>() : c.Attachments.Select(a => new { a.Id, a.Name, a.Kind, a.Mime, a.Bytes }).ToArray(),
            notes = c.Notes.Select(n => new { n.Id, n.Body, author = n.CreatedBy?.Name, n.CreatedAt }),
            updatedAt = c.UpdatedAt,
            print = print ? new { notice = "Printed from Admin · no logins included", omitVault = true, omitCare = true } : null
        };
    }

    private static async Task<Punch?> OpenPunch(AppDbContext db, Guid userId)
    {
        var last = await db.Punches.Where(p => p.UserId == userId && (p.Note == null || !p.Note.Contains("superseded")))
            .OrderByDescending(p => p.At).FirstOrDefaultAsync();
        return last is { Dir: "in" } ? last : null;
    }

    private static async Task PurgeFlags(AppDbContext db)
    {
        var due = await db.Flags.Where(f => f.PurgeAt != null && f.PurgeAt <= DateTime.UtcNow).ToListAsync();
        if (due.Count == 0) return;
        db.Flags.RemoveRange(due);
        await db.SaveChangesAsync();
    }

    private static double Hours(List<Punch> punches)
    {
        var ordered = punches.Where(p => p.Note == null || !p.Note.Contains("superseded")).OrderBy(p => p.At).ToList();
        double total = 0;
        DateTime? inn = null;
        foreach (var p in ordered)
        {
            if (p.Dir == "in") inn = p.At;
            else if (p.Dir == "out" && inn is DateTime i)
            {
                total += (p.At - i).TotalHours;
                inn = null;
            }
        }
        if (inn is DateTime open) total += (DateTime.UtcNow - open).TotalHours;
        return Math.Round(total, 2);
    }

    private static Dictionary<string, double> HoursByPlace(List<Punch> punches)
    {
        var result = new Dictionary<string, double> { ["office"] = 0, ["road"] = 0, ["home"] = 0 };
        foreach (var g in punches.GroupBy(p => p.Workplace))
            result[g.Key] = Hours(g.ToList());
        return result;
    }

    private static string Csv(string? v)
    {
        v ??= "";
        if (v.Contains(',') || v.Contains('"') || v.Contains('\n')) return "\"" + v.Replace("\"", "\"\"") + "\"";
        return v;
    }

    private static async Task<IResult> DownloadFile(HttpContext ctx, Guid id, AppDbContext db, FileStore store)
    {
        var deny = Authz.RequireStaff(ctx);
        if (deny is not null && !Authz.Actor(ctx).IsToken) return deny;
        var att = await db.Attachments.FirstOrDefaultAsync(a => a.Id == id);
        if (att is null) return Results.NotFound();
        var opened = await store.OpenAsync(att.BlobKey, att.Mime, ctx.RequestAborted);
        if (opened is null) return Results.NotFound();
        return Results.File(opened.Value.Stream, opened.Value.Mime, att.Name);
    }
}
