using Bis.Admin.Api.Models;

namespace Bis.Admin.Api.Api;

public record LoginRequest(string Email, string Password);
public record PunchClockRequest(string? Dir, string? Workplace, string? Destination);
public record PunchEditRequest(DateTime At, string? Note, string? Reason);
public record FlagCreateRequest(Guid ClientId, Guid LevelId, string Body, Guid? PersonId);
public record KudosCreateRequest(Guid ToUserId, string Body);
public record PostCreateRequest(string Kind, string Body, string? Title);
public record CommentCreateRequest(string Body);
public record StickyCreateRequest(double X, double Y, string Color, string Text, Guid? PinnedUserId);
public record StickyMoveRequest(double X, double Y, string? Text, Guid? PinnedUserId);
public record UserCreateRequest(string Name, string Email, string Role, Guid? DepartmentId, Guid? ManagerId, string? PhoneMobile, string? PhoneWork, string? Ext, string? Title, string? Password);
public record ProfileUpdateRequest(string? Name, string? PhoneMobile, string? PhoneWork, string? Ext, string? Birthday, int? BirthdayMonth, int? BirthdayDay, int? BirthdayYear, bool? ClearBirthday, string? WorkAnniversary, int? WorkAnniversaryMonth, int? WorkAnniversaryDay, int? WorkAnniversaryYear, bool? ClearWorkAnniversary);
public record TeamBirthdayRequest(string? Birthday, int? BirthdayMonth, int? BirthdayDay, int? BirthdayYear, bool? ClearBirthday, string? WorkAnniversary, int? WorkAnniversaryMonth, int? WorkAnniversaryDay, int? WorkAnniversaryYear, bool? ClearWorkAnniversary);
public record ClientCreateRequest(string Name, string? Industry, string? Status, string? County, string? BusinessPhone, string? BusinessEmail, string? Website);
public record ClientUpdateRequest(string? Name, string? Industry, string? Status, string? County, string? BusinessPhone, string? BusinessEmail, string? Website);
public record PersonWriteRequest(string Name, string? Title, string? Department, string? Email, string? Phone, bool Pinned, bool Primary);
public record PersonPinRequest(bool Pinned);
public record AddressWriteRequest(string Label, string? Line1, string? City, string? State, string? Zip, string? County, string? Hours, bool IsPrimary, string? Phone);
public record ClientServiceWriteRequest(Guid? ServiceTypeId, bool? On, string? Note);
public record ClientLinkWriteRequest(string Label, string Url);
public record ClientVendorWriteRequest(string Kind, string Name, string? Phone);
public record VaultWriteRequest(string Department, string Title, string? Username, string Secret, string? Url, string? Note);
public record NamedRequest(string Name, string? Description, string? Color);
public record TokenCreateRequest(string Name, string? Contact, bool Internal);
public record RevertRequest(string? Reason);
public record SettingWriteRequest(string? CompanyName, bool? ShowPresence, int? IdleMinutes, bool? GeofenceOffice, int? ClipboardClearSeconds);
public record WorkspaceSettingsDto(string CompanyName, int IdleMinutes, int ClipboardClearSeconds);

public record HomeStatsDto(int Wins, int OnRoad, int InOffice, int OpenFlags);
public record HomeCommentDto(Guid Id, string Body, string? Author, DateTime CreatedAt);
public record HomePostDto(Guid Id, string Kind, string Title, string Body, DateTime CreatedAt, DateOnly WeekStart, string? Author, IEnumerable<HomeCommentDto> Comments, int Thumbs);
public record HomeStarDto(string? To, string Body, Guid From);
public record HomeMentionBarDto(Guid UserId, string Name, int Count);
public record HomeKudosTopDto(Guid UserId, string? Name, string Initials, string? AvatarColor, int Stars);
public record HomeBirthdayDto(Guid Id, string Name, string Initials);
public record HomeCelebrationDto(Guid Id, string Name, string Initials, string Kind);
public record HomeBoardDto(DateOnly WeekStart, DateOnly WeekEnd, string WeekLabel, string Tz, HomeStatsDto Stats, IEnumerable<HomePostDto> Posts, HomeStarDto? StarOfDay, IEnumerable<HomeMentionBarDto> Mentions, IEnumerable<HomeKudosTopDto> KudosTop, IEnumerable<HomeBirthdayDto> Birthdays, IEnumerable<HomeBirthdayDto> Anniversaries, IEnumerable<HomeCelebrationDto> Celebrations);

public record ClientListRowDto(Guid Id, string Name, string? Industry, string Status, string? County, string? Primary, string? Address, string? ContractEnd, string? BusinessPhone, string? BusinessEmail, string? Website);
public record ClientBusinessDto(string? Call, string? Email, string? Map, string? MapLabel, string? Website);
public record ClientPersonDto(Guid Id, string Name, string? Title, string? Department, string? Email, string? Phone, bool Pinned, bool Primary, string Initials, string? AvatarColor);
public record ClientAddressDto(Guid Id, string Label, string? Line1, string? City, string? State, string? Zip, string? County, string? Hours, bool IsPrimary, string? Phone, string Maps);
public record ClientServiceDto(Guid Id, Guid ServiceTypeId, string? Name, bool On, string? Note);
public record ClientLinkDto(Guid Id, string Label, string Url);
public record ClientVendorDto(Guid Id, string Kind, string Name, string? Phone);
public record VaultMaskedDto(Guid Id, string Department, string Title, string? Username, string Secret, string? Url, string? Note);
public record ClientFlagDto(Guid Id, string Body, DateTime CreatedAt, string? Level, string? Color, string On, string? CreatedBy);
public record ClientFileDto(Guid Id, string Name, string? Industry, string Status, string? County, string? BusinessPhone, string? BusinessEmail, string? Website, ClientBusinessDto Business, IEnumerable<ClientPersonDto> People, IEnumerable<ClientAddressDto> Addresses, IEnumerable<ClientServiceDto> Services, IEnumerable<ClientLinkDto> Links, IEnumerable<ClientVendorDto> Vendors, IEnumerable<VaultMaskedDto> Vault, IEnumerable<ClientFlagDto> Flags, IEnumerable<object> Files, IEnumerable<object> Notes);

public record FlagRowDto(Guid Id, string Body, DateTime CreatedAt, DateTime? ArchivedAt, DateTime? PurgeAt, int? DaysLeft, string? Level, string? Color, string On, Guid ClientId, string? Client, Guid CreatedById, string? CreatedBy);
public record CreatedIdDto(Guid Id);

public static class Maps
{
    public static object UserCard(User u, Punch? open, int kudosWeek, int kudosMonth, int mentionsWeek) => new
    {
        u.Id,
        u.Name,
        u.Email,
        u.PhoneMobile,
        u.PhoneWork,
        u.Ext,
        u.Role,
        u.Title,
        departmentId = u.DepartmentId,
        department = u.Department?.Name,
        managerId = u.ManagerId,
        manager = u.Manager?.Name,
        photoBlob = u.PhotoBlob,
        initials = Initials(u.Name),
        avatarColor = u.AvatarColor,
        birthday = u.Birthday,
        birthdayInWindow = u.BirthdayInWindowOverride || (u.Birthday is DateOnly b && Services.ChicagoClock.InBirthdayWindow(b, Services.ChicagoClock.Today)),
        workAnniversary = u.WorkAnniversary,
        workAnniversaryInWindow = u.WorkAnniversary is DateOnly a && Services.ChicagoClock.InCelebrationWindow(a, Services.ChicagoClock.Today),
        coveringFor = u.CoveringFor,
        notes = u.Notes,
        where = Presence(open),
        openPunch = open is null ? null : new { open.Dir, open.Workplace, open.Destination, open.At },
        kudosWeek,
        kudosMonth,
        mentionsWeek
    };

    public static string Initials(string name)
    {
        var parts = name.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0) return "?";
        if (parts.Length == 1) return parts[0][..1].ToUpperInvariant();
        return $"{parts[0][0]}{parts[^1][0]}".ToUpperInvariant();
    }

    public static object Presence(Punch? open)
    {
        if (open is null || open.Dir != "in") return new { status = "out", label = "Out", workplace = (string?)null, destination = (string?)null };
        return new { status = open.Workplace, label = Label(open.Workplace), workplace = open.Workplace, destination = open.Destination };
    }

    public static string Label(string workplace) => workplace switch
    {
        "office" => "Office",
        "road" => "Road",
        "home" => "Home",
        _ => workplace
    };

    public static object VaultMasked(Credential c) => new
    {
        c.Id,
        c.Department,
        c.Title,
        c.Username,
        secret = "••••••••",
        c.Url,
        c.Note
    };
}
