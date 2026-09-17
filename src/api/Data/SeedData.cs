using System.Security.Cryptography;
using System.Text;
using Bis.Admin.Api.Models;
using Bis.Admin.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Bis.Admin.Api.Data;

public static class SeedData
{
    public const string SeedPassword = "Admin!2026";

    public static async Task EnsureAsync(AppDbContext db, VaultCrypto vault, IConfiguration config, ILogger log, FileStore files)
    {
        await EnsureClipboardClearColumnAsync(db);
        if (await db.Users.AnyAsync())
        {
            log.LogInformation("Seed skipped — users already present.");
            await files.EnsureSeedBlobsAsync(db);
            return;
        }

        var now = DateTime.UtcNow;
        var week = ChicagoClock.WeekStart();
        var todayChi = ChicagoClock.Today;
        var hash = BCrypt.Net.BCrypt.HashPassword(SeedPassword);

        var ops = new Department { Id = Guid.Parse("11111111-1111-1111-1111-111111111101"), Name = "Operations" };
        var it = new Department { Id = Guid.Parse("11111111-1111-1111-1111-111111111102"), Name = "IT" };
        var digital = new Department { Id = Guid.Parse("11111111-1111-1111-1111-111111111103"), Name = "Digital" };
        var billing = new Department { Id = Guid.Parse("11111111-1111-1111-1111-111111111104"), Name = "Billing" };
        db.Departments.AddRange(ops, it, digital, billing);

        foreach (var c in new[] { "Denton", "Dallas", "Tarrant", "Collin" })
            db.Counties.Add(new County { Id = Guid.NewGuid(), Name = c });

        var brandon = new User
        {
            Id = Guid.Parse("22222222-2222-2222-2222-222222222201"),
            Name = "Brandon Kay",
            Email = "brandon@bisconsultants.example",
            PhoneMobile = "(214) 773-3095",
            PhoneWork = "(940) 555-0100",
            Ext = "101",
            DepartmentId = ops.Id,
            Role = Roles.Admin,
            ManagerId = null,
            PasswordHash = hash,
            CreatedAt = now,
            Title = "Principal",
            AvatarColor = "#1c332c",
            Notes = "Owns the shop. Time edits on staff notify him."
        };
        var maya = new User
        {
            Id = Guid.Parse("22222222-2222-2222-2222-222222222202"),
            Name = "Maya Chen",
            Email = "maya@bisconsultants.example",
            PhoneMobile = "(940) 555-0101",
            PhoneWork = "(940) 555-0100",
            Ext = "204",
            DepartmentId = it.Id,
            Role = Roles.Staff,
            ManagerId = brandon.Id,
            PasswordHash = hash,
            CreatedAt = now,
            Title = "Technician",
            Birthday = todayChi,
            BirthdayInWindowOverride = true,
            AvatarColor = "#2b5f8a",
            Notes = "Best first call on angry NAS jobs. Don’t schedule her Friday afternoons if you can help it."
        };
        var chris = new User
        {
            Id = Guid.Parse("22222222-2222-2222-2222-222222222203"),
            Name = "Chris Patel",
            Email = "chris@bisconsultants.example",
            PhoneMobile = "(214) 555-0172",
            PhoneWork = "(940) 555-0100",
            Ext = "118",
            DepartmentId = digital.Id,
            Role = Roles.Staff,
            ManagerId = brandon.Id,
            PasswordHash = hash,
            CreatedAt = now,
            Title = "Designer",
            AvatarColor = "#6b4a7a",
            Notes = "POS and sites. Quiet Fridays if a cutover is on the board."
        };
        var sam = new User
        {
            Id = Guid.Parse("22222222-2222-2222-2222-222222222204"),
            Name = "Sam Ortiz",
            Email = "sam@bisconsultants.example",
            PhoneMobile = "(940) 555-0160",
            PhoneWork = "(940) 555-0100",
            Ext = "205",
            DepartmentId = it.Id,
            Role = Roles.Staff,
            ManagerId = brandon.Id,
            PasswordHash = hash,
            CreatedAt = now,
            Title = "Technician",
            AvatarColor = "#8a5a2b",
            CoveringFor = "Maya · Denton stops",
            Notes = "New-ish. Pair with Maya on first visits."
        };
        db.Users.AddRange(brandon, maya, chris, sam);
        await db.SaveChangesAsync();

        var warning = new FlagLevel { Id = Guid.Parse("33333333-3333-3333-3333-333333333301"), Name = "Warning", Color = "warn", Description = "Red · don’t break this" };
        var care = new FlagLevel { Id = Guid.Parse("33333333-3333-3333-3333-333333333302"), Name = "Care", Color = "care", Description = "Amber · treat this person gently" };
        var noteLevel = new FlagLevel { Id = Guid.Parse("33333333-3333-3333-3333-333333333303"), Name = "Note", Color = "note", Description = "Neutral · useful context" };
        var legal = new FlagLevel { Id = Guid.Parse("33333333-3333-3333-3333-333333333304"), Name = "Legal", Color = "note", Description = "Custom · added by admin" };
        db.FlagLevels.AddRange(warning, care, noteLevel, legal);

        var svcMit = new ServiceType { Id = Guid.Parse("44444444-4444-4444-4444-444444444401"), Name = "Managed IT", Description = "Ongoing support" };
        var svcM365 = new ServiceType { Id = Guid.Parse("44444444-4444-4444-4444-444444444402"), Name = "Microsoft 365", Description = "Tenant + seats" };
        var svcBak = new ServiceType { Id = Guid.Parse("44444444-4444-4444-4444-444444444403"), Name = "Backup", Description = "Cloud or local" };
        var svcWeb = new ServiceType { Id = Guid.Parse("44444444-4444-4444-4444-444444444404"), Name = "Website", Description = "Host and care" };
        var svcOn = new ServiceType { Id = Guid.Parse("44444444-4444-4444-4444-444444444405"), Name = "On-site support", Description = "Visit work" };
        db.ServiceTypes.AddRange(svcMit, svcM365, svcBak, svcWeb, svcOn);

        db.CustomFieldDefs.Add(new CustomFieldDef { Id = Guid.NewGuid(), Name = "Contract end", Type = "date" });

        db.CompanySettings.Add(new CompanySettings
        {
            Id = Guid.Parse("55555555-5555-5555-5555-555555555501"),
            CompanyName = "BIS Consultants",
            IdleMinutes = 15,
            ClipboardClearSeconds = 30,
            SsoEnabled = string.Equals(config["SSO_ENABLED"], "true", StringComparison.OrdinalIgnoreCase),
            SsoProvider = "Microsoft Entra ID",
            OfficeAddress = "BIS shop · Denton",
            TimeZone = "America/Chicago"
        });

        var murray = new Client
        {
            Id = Guid.Parse("66666666-6666-6666-6666-666666666601"),
            Name = "Murray Media",
            Industry = "Media",
            Status = "Active",
            County = "Denton",
            BusinessPhone = "(940) 555-2500",
            BusinessEmail = "info@murraymedia.example",
            Website = "https://murraymedia.example",
            CustomFieldsJson = """{"Contract end":"2027-03-01"}""",
            CreatedAt = now.AddDays(-40),
            UpdatedAt = now.AddHours(-2),
            UpdatedById = maya.Id
        };
        var northstar = new Client
        {
            Id = Guid.Parse("66666666-6666-6666-6666-666666666602"),
            Name = "Northstar Dental",
            Industry = "Healthcare",
            Status = "Active",
            County = "Denton",
            BusinessPhone = "(972) 555-2210",
            BusinessEmail = "hello@northstardental.example",
            Website = "https://northstardental.example",
            CustomFieldsJson = """{"Contract end":"2027-03-01"}""",
            CreatedAt = now.AddDays(-80),
            UpdatedAt = now.AddDays(-1)
        };
        var oak = new Client
        {
            Id = Guid.Parse("66666666-6666-6666-6666-666666666603"),
            Name = "Oak + Iron Realty",
            Industry = "Real estate",
            Status = "Active",
            County = "Collin",
            BusinessPhone = "(214) 555-8800",
            BusinessEmail = "james@oakandiron.example",
            Website = "https://oakandiron.example",
            CreatedAt = now.AddDays(-20),
            UpdatedAt = now.AddDays(-3)
        };
        var pecan = new Client
        {
            Id = Guid.Parse("66666666-6666-6666-6666-666666666604"),
            Name = "Pecan Street Cafe",
            Industry = "Food",
            Status = "Active",
            County = "Denton",
            BusinessPhone = "(940) 555-1190",
            BusinessEmail = "luis@pecanstreet.example",
            Website = "https://pecanstreet.example",
            CustomFieldsJson = """{"Contract end":"2027-03-01"}""",
            CreatedAt = now.AddDays(-15),
            UpdatedAt = now.AddDays(-2)
        };
        var harbor = new Client
        {
            Id = Guid.Parse("66666666-6666-6666-6666-666666666605"),
            Name = "Harbor Kids Academy",
            Industry = "Education",
            Status = "Prospect",
            County = "Denton",
            CreatedAt = now.AddDays(-4),
            UpdatedAt = now.AddDays(-4)
        };
        db.Clients.AddRange(murray, northstar, oak, pecan, harbor);

        var bre = new Person { Id = Guid.Parse("77777777-7777-7777-7777-777777777701"), ClientId = murray.Id, Name = "Bre", Title = "Owner", Department = "Operations", Email = "bre@murraymedia.example", Phone = "(940) 555-0140", Pinned = true, Primary = true, AvatarColor = "#2b5f8a" };
        var scott = new Person { Id = Guid.Parse("77777777-7777-7777-7777-777777777702"), ClientId = murray.Id, Name = "Scott", Title = "Studio IT", Department = "IT", Email = "scott@murraymedia.example", Phone = "(940) 555-0141", AvatarColor = "#1e7d5f" };
        var jordan = new Person { Id = Guid.Parse("77777777-7777-7777-7777-777777777703"), ClientId = murray.Id, Name = "Jordan Hale", Title = "IT", Department = "IT", Email = "jordan@murraymedia.example", Phone = "(940) 555-0143", AvatarColor = "#3d6b5a" };
        var ronnie = new Person { Id = Guid.Parse("77777777-7777-7777-7777-777777777704"), ClientId = murray.Id, Name = "Ronnie", Title = "Designer", Department = "Digital", Email = "ronnie@murraymedia.example", Phone = "(940) 555-0142", AvatarColor = "#8a5a2b" };
        var ana = new Person { Id = Guid.Parse("77777777-7777-7777-7777-777777777705"), ClientId = murray.Id, Name = "Ana Ruiz", Title = "Designer", Department = "Digital", Email = "ana@murraymedia.example", Phone = "(940) 555-0144", AvatarColor = "#6b4a7a" };
        murray.PrimaryPersonId = bre.Id;
        db.People.AddRange(
            bre, scott, jordan, ronnie, ana,
            new Person { Id = Guid.NewGuid(), ClientId = northstar.Id, Name = "Priya Shah", Title = "Office manager", Department = "Operations", Email = "priya@northstardental.example", Phone = "(972) 555-2211", Primary = true, Pinned = true, AvatarColor = "#2b5f8a" },
            new Person { Id = Guid.NewGuid(), ClientId = oak.Id, Name = "James Oak", Title = "Broker", Department = "Operations", Email = "james@oakandiron.example", Phone = "(214) 555-8801", Primary = true, Pinned = true, AvatarColor = "#1c332c" },
            new Person { Id = Guid.NewGuid(), ClientId = oak.Id, Name = "Pam Ellis", Title = "Billing", Department = "Billing", Email = "pam@oakandiron.example", Phone = "(214) 555-8802", AvatarColor = "#8a4b12" },
            new Person { Id = Guid.NewGuid(), ClientId = pecan.Id, Name = "Luis Ortega", Title = "Owner", Department = "Operations", Email = "luis@pecanstreet.example", Phone = "(940) 555-1190", Primary = true, Pinned = true, AvatarColor = "#8a5a2b" }
        );

        db.Addresses.AddRange(
            new Address { Id = Guid.NewGuid(), ClientId = murray.Id, Label = "Studio", Line1 = "1840 Script Lane", City = "Denton", State = "TX", Zip = "76201", County = "Denton", IsPrimary = true, Phone = "(940) 555-2500", Hours = "Mon–Fri 8–6" },
            new Address { Id = Guid.NewGuid(), ClientId = murray.Id, Label = "Storage", Line1 = "Unit 12, Mill Street", City = "Denton", State = "TX", Zip = "76205", County = "Denton", Hours = "Archives and print overflow" },
            new Address { Id = Guid.NewGuid(), ClientId = northstar.Id, Label = "Office", Line1 = "210 Main St", City = "Lewisville", State = "TX", Zip = "75057", County = "Denton", IsPrimary = true },
            new Address { Id = Guid.NewGuid(), ClientId = oak.Id, Label = "Office", Line1 = "88 Preston Rd", City = "Frisco", State = "TX", Zip = "75034", County = "Collin", IsPrimary = true },
            new Address { Id = Guid.NewGuid(), ClientId = pecan.Id, Label = "Cafe", Line1 = "119 W Hickory", City = "Denton", State = "TX", Zip = "76201", County = "Denton", IsPrimary = true }
        );

        db.ClientServices.AddRange(
            new ClientService { Id = Guid.NewGuid(), ClientId = murray.Id, ServiceTypeId = svcMit.Id, On = true, Note = "Monthly" },
            new ClientService { Id = Guid.NewGuid(), ClientId = murray.Id, ServiceTypeId = svcM365.Id, On = true, Note = "13 seats" },
            new ClientService { Id = Guid.NewGuid(), ClientId = murray.Id, ServiceTypeId = svcOn.Id, On = false, Note = "As needed" },
            new ClientService { Id = Guid.NewGuid(), ClientId = northstar.Id, ServiceTypeId = svcMit.Id, On = true },
            new ClientService { Id = Guid.NewGuid(), ClientId = northstar.Id, ServiceTypeId = svcBak.Id, On = true },
            new ClientService { Id = Guid.NewGuid(), ClientId = pecan.Id, ServiceTypeId = svcMit.Id, On = true }
        );

        db.Links.AddRange(
            new Link { Id = Guid.NewGuid(), ClientId = murray.Id, Label = "Website", Url = "https://murraymedia.example" },
            new Link { Id = Guid.NewGuid(), ClientId = murray.Id, Label = "Remote access", Url = "https://remote.murraymedia.example" },
            new Link { Id = Guid.NewGuid(), ClientId = murray.Id, Label = "Adobe admin", Url = "https://adminconsole.adobe.com" }
        );
        db.Vendors.AddRange(
            new Vendor { Id = Guid.NewGuid(), ClientId = murray.Id, Kind = "Internet", Name = "Spectrum", Phone = "(877) 555-0199" },
            new Vendor { Id = Guid.NewGuid(), ClientId = murray.Id, Kind = "Phones", Name = "Nextiva" },
            new Vendor { Id = Guid.NewGuid(), ClientId = murray.Id, Kind = "Adobe", Name = "Reseller · CDW" }
        );

        void AddVault(Guid clientId, string dept, string title, string user, string secret)
        {
            var (iv, cipher) = vault.Encrypt(secret);
            db.Credentials.Add(new Credential
            {
                Id = Guid.NewGuid(),
                ClientId = clientId,
                Department = dept,
                Title = title,
                Username = user,
                SecretIv = iv,
                SecretCipher = cipher
            });
        }
        AddVault(murray.Id, "IT", "Studio NAS", "scott", "not-a-real-nas-secret");
        AddVault(murray.Id, "IT", "Studio Wi-Fi", "MurrayStudio", "not-a-real-wifi-secret");
        AddVault(murray.Id, "IT", "Camera system", "admin", "not-a-real-cam-secret");
        AddVault(murray.Id, "Digital", "Adobe", "bre@murraymedia.example", "not-a-real-adobe-secret");

        db.Flags.AddRange(
            new Flag
            {
                Id = Guid.Parse("88888888-8888-8888-8888-888888888801"),
                ClientId = murray.Id,
                LevelId = warning.Id,
                Body = "Do not shut down their servers. Production depends on the studio NAS.",
                CreatedById = maya.Id,
                CreatedAt = now.AddHours(-8)
            },
            new Flag
            {
                Id = Guid.Parse("88888888-8888-8888-8888-888888888802"),
                ClientId = murray.Id,
                PersonId = scott.Id,
                LevelId = care.Id,
                Body = "Scott’s mother died. Keep visits light. Don’t call him first this week.",
                CreatedById = brandon.Id,
                CreatedAt = now.AddHours(-30)
            },
            new Flag
            {
                Id = Guid.Parse("88888888-8888-8888-8888-888888888803"),
                ClientId = oak.Id,
                LevelId = care.Id,
                Body = "Out sick this week. Route billing to James.",
                CreatedById = chris.Id,
                CreatedAt = now.AddDays(-2)
            },
            new Flag
            {
                Id = Guid.Parse("88888888-8888-8888-8888-888888888804"),
                ClientId = pecan.Id,
                LevelId = noteLevel.Id,
                Body = "Old Wi-Fi swap — finished",
                CreatedById = brandon.Id,
                CreatedAt = now.AddDays(-40),
                ArchivedAt = now.AddDays(-28),
                PurgeAt = now.AddDays(62)
            }
        );

        db.Notes.Add(new Note
        {
            Id = Guid.NewGuid(),
            ClientId = murray.Id,
            Body = "Standing context only. Digital team on Adobe. Bre asked about Microsoft 365 and docks. Use Flags when the team needs to see something before they walk in. Ask @Scott before touching the NAS.",
            CreatedById = brandon.Id,
            CreatedAt = now.AddDays(-6)
        });

        db.Attachments.AddRange(
            new Attachment { Id = Guid.Parse("66666666-6666-6666-6666-6666666666a1"), ClientId = murray.Id, Kind = "file", Name = "Murray_IT_audit.pdf", BlobKey = "seed/Murray_IT_audit.pdf", Mime = "application/pdf", Bytes = 1, CreatedAt = now.AddDays(-10) },
            new Attachment { Id = Guid.Parse("66666666-6666-6666-6666-6666666666a2"), ClientId = murray.Id, Kind = "file", Name = "Scope_of_work.docx", BlobKey = "seed/Scope_of_work.docx", Mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document", Bytes = 1, CreatedAt = now.AddDays(-8) },
            new Attachment { Id = Guid.Parse("66666666-6666-6666-6666-6666666666a3"), ClientId = murray.Id, Kind = "file", Name = "License_seats.xlsx", BlobKey = "seed/License_seats.xlsx", Mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", Bytes = 1, CreatedAt = now.AddDays(-7) }
        );

        var win = new Post
        {
            Id = Guid.Parse("99999999-9999-9999-9999-999999999901"),
            Kind = "win",
            Title = "Northstar Dental signed a 24-month renewal",
            Body = "Priya called Maya after the on-site and said the new backup “just works.” That’s the job. Shout-out @Maya.",
            CreatedById = brandon.Id,
            CreatedAt = now.AddHours(-6),
            WeekStart = week
        };
        var upd = new Post
        {
            Id = Guid.Parse("99999999-9999-9999-9999-999999999902"),
            Kind = "update",
            Title = "Shop closed Friday noon",
            Body = "Inventory and trucks. Clock out Home or Road if you’re already on a job. Ping @Brandon if you need the shop open.",
            CreatedById = brandon.Id,
            CreatedAt = now.AddDays(-1),
            WeekStart = week
        };
        var win2 = new Post
        {
            Id = Guid.NewGuid(),
            Kind = "win",
            Title = "Pecan Street Cafe POS cutover",
            Body = "Clean cutover. @Chris owned the floor.",
            CreatedById = chris.Id,
            CreatedAt = week.ToDateTime(TimeOnly.Parse("09:00")).ToUniversalTime(),
            WeekStart = week
        };
        db.Posts.AddRange(win, upd, win2);
        db.Comments.AddRange(
            new Comment { Id = Guid.NewGuid(), PostId = win.Id, Body = "Thank you — felt good to hear it from her.", CreatedById = maya.Id, CreatedAt = now.AddHours(-5) },
            new Comment { Id = Guid.NewGuid(), PostId = win.Id, Body = "Nice work M.", CreatedById = chris.Id, CreatedAt = now.AddHours(-4) }
        );

        db.Kudos.AddRange(
            new Kudos { Id = Guid.NewGuid(), ToUserId = maya.Id, FromUserId = brandon.Id, Body = "Owned the Northstar on-site.", WeekStart = week, CreatedAt = now.AddHours(-5) },
            new Kudos { Id = Guid.NewGuid(), ToUserId = maya.Id, FromUserId = sam.Id, Body = "Talked a panicked owner off the ledge Tuesday.", WeekStart = week, CreatedAt = now.AddDays(-1) },
            new Kudos { Id = Guid.NewGuid(), ToUserId = maya.Id, FromUserId = chris.Id, Body = "Walked Priya through the backup cutover.", WeekStart = week, CreatedAt = now.AddDays(-2) },
            new Kudos { Id = Guid.NewGuid(), ToUserId = maya.Id, FromUserId = brandon.Id, Body = "First call on the angry NAS job.", WeekStart = week, CreatedAt = now.AddDays(-3) },
            new Kudos { Id = Guid.NewGuid(), ToUserId = chris.Id, FromUserId = maya.Id, Body = "POS cutover at Pecan Street — clean.", WeekStart = week, CreatedAt = now.AddDays(-2) },
            new Kudos { Id = Guid.NewGuid(), ToUserId = chris.Id, FromUserId = brandon.Id, Body = "Quote pack for Northstar second office.", WeekStart = week, CreatedAt = now.AddDays(-3) },
            new Kudos { Id = Guid.NewGuid(), ToUserId = chris.Id, FromUserId = sam.Id, Body = "Kept Digital moving while Maya was on-site.", WeekStart = week, CreatedAt = now.AddDays(-4) },
            new Kudos { Id = Guid.NewGuid(), ToUserId = brandon.Id, FromUserId = maya.Id, Body = "Cleared the Friday shop-close plan.", WeekStart = week, CreatedAt = now.AddHours(-20) }
        );
        // Prior weeks for month totals
        var lastWeek = week.AddDays(-7);
        db.Kudos.AddRange(
            new Kudos { Id = Guid.NewGuid(), ToUserId = maya.Id, FromUserId = brandon.Id, Body = "Covered Saturday on-call.", WeekStart = lastWeek, CreatedAt = now.AddDays(-10) },
            new Kudos { Id = Guid.NewGuid(), ToUserId = maya.Id, FromUserId = chris.Id, Body = "Docs for Denton Spectrum.", WeekStart = lastWeek, CreatedAt = now.AddDays(-11) },
            new Kudos { Id = Guid.NewGuid(), ToUserId = maya.Id, FromUserId = sam.Id, Body = "Paired Sam on first visit.", WeekStart = lastWeek, CreatedAt = now.AddDays(-12) },
            new Kudos { Id = Guid.NewGuid(), ToUserId = maya.Id, FromUserId = brandon.Id, Body = "Zero after-hours tickets Saturday.", WeekStart = lastWeek, CreatedAt = now.AddDays(-9) },
            new Kudos { Id = Guid.NewGuid(), ToUserId = chris.Id, FromUserId = maya.Id, Body = "Site copy for Oak + Iron.", WeekStart = lastWeek, CreatedAt = now.AddDays(-10) },
            new Kudos { Id = Guid.NewGuid(), ToUserId = brandon.Id, FromUserId = chris.Id, Body = "Kept the board honest.", WeekStart = lastWeek, CreatedAt = now.AddDays(-11) },
            new Kudos { Id = Guid.NewGuid(), ToUserId = brandon.Id, FromUserId = sam.Id, Body = "Signed the Northstar paper.", WeekStart = lastWeek.AddDays(-7), CreatedAt = now.AddDays(-18) },
            new Kudos { Id = Guid.NewGuid(), ToUserId = sam.Id, FromUserId = maya.Id, Body = "Showed up early for the Denton run.", WeekStart = lastWeek, CreatedAt = now.AddDays(-10) },
            new Kudos { Id = Guid.NewGuid(), ToUserId = sam.Id, FromUserId = brandon.Id, Body = "Took notes that actually helped.", WeekStart = lastWeek.AddDays(-7), CreatedAt = now.AddDays(-18) }
        );

        db.Stickies.AddRange(
            new Sticky { Id = Guid.NewGuid(), X = 40, Y = 36, Color = "s-y", Text = "Donuts in the kitchen", PinnedUserId = maya.Id, CreatedById = maya.Id, CreatedAt = now.AddHours(-3) },
            new Sticky { Id = Guid.NewGuid(), X = 240, Y = 80, Color = "s-p", Text = "Van 2 needs gas before Friday @Brandon", PinnedUserId = brandon.Id, CreatedById = chris.Id, CreatedAt = now.AddHours(-2) },
            new Sticky { Id = Guid.NewGuid(), X = 460, Y = 50, Color = "s-b", Text = "Northstar wants a quote on the second office", PinnedUserId = chris.Id, CreatedById = chris.Id, CreatedAt = now.AddHours(-4) },
            new Sticky { Id = Guid.NewGuid(), X = 160, Y = 230, Color = "s-g", Text = "Shop fridge is a science project", CreatedById = sam.Id, CreatedAt = now.AddHours(-6) }
        );

        DateTime Chi(int daysAgo, int hour, int min)
        {
            var local = ChicagoClock.Now.Date.AddDays(-daysAgo).AddHours(hour).AddMinutes(min);
            return TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(local, DateTimeKind.Unspecified), ChicagoClock.Zone);
        }
        db.Punches.AddRange(
            new Punch { Id = Guid.NewGuid(), UserId = brandon.Id, Dir = "in", Workplace = "office", At = Chi(0, 8, 2) },
            new Punch { Id = Guid.NewGuid(), UserId = maya.Id, Dir = "in", Workplace = "road", Destination = "Murray Media", At = Chi(0, 8, 14) },
            new Punch { Id = Guid.NewGuid(), UserId = chris.Id, Dir = "in", Workplace = "home", At = Chi(0, 8, 30) },
            new Punch { Id = Guid.NewGuid(), UserId = brandon.Id, Dir = "in", Workplace = "office", At = Chi(1, 8, 2) },
            new Punch { Id = Guid.NewGuid(), UserId = brandon.Id, Dir = "out", Workplace = "office", At = Chi(1, 17, 11) },
            new Punch { Id = Guid.NewGuid(), UserId = maya.Id, Dir = "in", Workplace = "road", Destination = "Northstar", At = Chi(1, 8, 10) },
            new Punch { Id = Guid.NewGuid(), UserId = maya.Id, Dir = "out", Workplace = "road", Destination = "Northstar", At = Chi(1, 16, 51) },
            new Punch { Id = Guid.NewGuid(), UserId = sam.Id, Dir = "in", Workplace = "office", At = Chi(1, 8, 0) },
            new Punch { Id = Guid.NewGuid(), UserId = sam.Id, Dir = "out", Workplace = "office", At = Chi(1, 17, 8) }
        );

        void Mention(Guid userId, string type, Guid source, string snippet, DateTime at) =>
            db.Mentions.Add(new Mention { Id = Guid.NewGuid(), UserId = userId, SourceType = type, SourceId = source, Snippet = snippet, CreatedAt = at });

        Mention(brandon.Id, "sticky", db.Stickies.Local.First(s => s.Text.Contains("Van 2")).Id, "Van 2 needs gas before Friday @Brandon", now.AddHours(-2));
        Mention(maya.Id, "post", win.Id, "Shout-out @Maya on the Northstar on-site", now.AddHours(-6));
        Mention(maya.Id, "kudos", Guid.Empty, "@Maya talked a panicked owner off the ledge", now.AddDays(-1));
        Mention(brandon.Id, "post", upd.Id, "Ping @Brandon if you need the shop open.", now.AddDays(-1));
        Mention(chris.Id, "post", win2.Id, "@Chris owned the floor.", now.AddDays(-2));

        void Tok(string name, string? contact, bool internalTok, bool enabled, string hint)
        {
            var raw = "adm_ext_" + Convert.ToHexString(RandomNumberGenerator.GetBytes(12)).ToLowerInvariant();
            db.AccessTokens.Add(new AccessToken
            {
                Id = Guid.NewGuid(),
                Name = name,
                Contact = contact,
                Internal = internalTok,
                Hash = TokenHash.Sha256(raw),
                PrefixHint = hint,
                Enabled = enabled,
                CreatedAt = now.AddDays(-20)
            });
        }
        Tok("Denton County GIS", "gis@dentoncounty.example", false, true, "n8r4");
        Tok("Internal reporting", null, true, true, "q1lm");
        Tok("Vendor sandbox", null, false, false, "");

        db.Audits.Add(new Audit
        {
            Id = Guid.NewGuid(),
            ActorId = maya.Id,
            Action = "edit",
            ObjectType = "person",
            ObjectId = scott.Id,
            ClientId = murray.Id,
            AfterJson = """{"phone":"(940) 555-0141"}""",
            CreatedAt = now.AddHours(-8)
        });

        await db.SaveChangesAsync();
        await files.EnsureSeedBlobsAsync(db);
        log.LogInformation("Seed complete. Brandon=admin Maya=staff password is the documented seed password (never logged).");
        _ = Encoding.UTF8.GetBytes(SeedPassword); // keep const referenced without logging
    }

    private static async Task EnsureClipboardClearColumnAsync(AppDbContext db)
    {
        if (!db.Database.IsSqlite()) return;
        await db.Database.OpenConnectionAsync();
        await using var cmd = db.Database.GetDbConnection().CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM pragma_table_info('CompanySettings') WHERE name='ClipboardClearSeconds'";
        var count = Convert.ToInt64(await cmd.ExecuteScalarAsync() ?? 0L);
        if (count == 0)
            await db.Database.ExecuteSqlRawAsync("""ALTER TABLE "CompanySettings" ADD COLUMN "ClipboardClearSeconds" INTEGER NOT NULL DEFAULT 30""");
    }
}
