namespace Bis.Admin.Api.Models;

public static class Roles
{
    public const string Staff = "staff";
    public const string Admin = "admin";
    public const string Token = "token";
}

public class User
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string? PhoneMobile { get; set; }
    public string? PhoneWork { get; set; }
    public string? Ext { get; set; }
    public Guid? DepartmentId { get; set; }
    public Department? Department { get; set; }
    public string Role { get; set; } = Roles.Staff;
    public Guid? ManagerId { get; set; }
    public User? Manager { get; set; }
    public string? PhotoBlob { get; set; }
    public string PasswordHash { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public string? Title { get; set; }
    public DateOnly? Birthday { get; set; }
    public string? CoveringFor { get; set; }
    public string? Notes { get; set; }
    public string AvatarColor { get; set; } = "#1c332c";
    public DateTime? LastSeenAt { get; set; }
    public DateTime? LastActiveAt { get; set; }
    public bool BirthdayInWindowOverride { get; set; }
}

public class Department
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
}

public class County
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
}

public class Client
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string? Industry { get; set; }
    public string Status { get; set; } = "Active";
    public string? County { get; set; }
    public string? BusinessPhone { get; set; }
    public string? BusinessEmail { get; set; }
    public string? Website { get; set; }
    public Guid? PrimaryPersonId { get; set; }
    public string? CustomFieldsJson { get; set; }
    public string? PhotoBlob { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Guid? UpdatedById { get; set; }
    public List<Person> People { get; set; } = new();
    public List<Address> Addresses { get; set; } = new();
    public List<ClientService> Services { get; set; } = new();
    public List<Link> Links { get; set; } = new();
    public List<Vendor> Vendors { get; set; } = new();
    public List<Credential> Credentials { get; set; } = new();
    public List<Flag> Flags { get; set; } = new();
    public List<Attachment> Attachments { get; set; } = new();
    public List<Note> Notes { get; set; } = new();
}

public class Person
{
    public Guid Id { get; set; }
    public Guid ClientId { get; set; }
    public Client? Client { get; set; }
    public string Name { get; set; } = "";
    public string? Title { get; set; }
    public string? Department { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? PhotoBlob { get; set; }
    public bool Pinned { get; set; }
    public bool Primary { get; set; }
    public string AvatarColor { get; set; } = "#2b5f8a";
}

public class Address
{
    public Guid Id { get; set; }
    public Guid ClientId { get; set; }
    public Client? Client { get; set; }
    public string Label { get; set; } = "";
    public string? Line1 { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Zip { get; set; }
    public string? County { get; set; }
    public string? Hours { get; set; }
    public bool IsPrimary { get; set; }
    public string? Phone { get; set; }
}

public class ServiceType
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
}

public class ClientService
{
    public Guid Id { get; set; }
    public Guid ClientId { get; set; }
    public Client? Client { get; set; }
    public Guid ServiceTypeId { get; set; }
    public ServiceType? ServiceType { get; set; }
    public bool On { get; set; }
    public string? Note { get; set; }
}

public class Link
{
    public Guid Id { get; set; }
    public Guid ClientId { get; set; }
    public Client? Client { get; set; }
    public string Label { get; set; } = "";
    public string Url { get; set; } = "";
}

public class Vendor
{
    public Guid Id { get; set; }
    public Guid ClientId { get; set; }
    public Client? Client { get; set; }
    public string Kind { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Phone { get; set; }
}

public class Credential
{
    public Guid Id { get; set; }
    public Guid ClientId { get; set; }
    public Client? Client { get; set; }
    public string Department { get; set; } = "";
    public string Title { get; set; } = "";
    public string? Username { get; set; }
    public byte[] SecretIv { get; set; } = Array.Empty<byte>();
    public byte[] SecretCipher { get; set; } = Array.Empty<byte>();
    public string? Url { get; set; }
    public string? Note { get; set; }
}

public class FlagLevel
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string Color { get; set; } = "";
    public string? Description { get; set; }
}

public class Flag
{
    public Guid Id { get; set; }
    public Guid ClientId { get; set; }
    public Client? Client { get; set; }
    public Guid? PersonId { get; set; }
    public Person? Person { get; set; }
    public Guid LevelId { get; set; }
    public FlagLevel? Level { get; set; }
    public string Body { get; set; } = "";
    public Guid CreatedById { get; set; }
    public User? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ArchivedAt { get; set; }
    public DateTime? PurgeAt { get; set; }
}

public class Attachment
{
    public Guid Id { get; set; }
    public Guid ClientId { get; set; }
    public Client? Client { get; set; }
    public string Kind { get; set; } = "file";
    public string Name { get; set; } = "";
    public string BlobKey { get; set; } = "";
    public string Mime { get; set; } = "application/octet-stream";
    public long Bytes { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class Note
{
    public Guid Id { get; set; }
    public Guid ClientId { get; set; }
    public Client? Client { get; set; }
    public string Body { get; set; } = "";
    public Guid CreatedById { get; set; }
    public User? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CustomFieldDef
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string Type { get; set; } = "text";
}

public class Punch
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public string Dir { get; set; } = "in";
    public string Workplace { get; set; } = "office";
    public string? Destination { get; set; }
    public DateTime At { get; set; }
    public Guid? EditedFrom { get; set; }
    public Guid? EditedById { get; set; }
    public string? Note { get; set; }
}

public class Post
{
    public Guid Id { get; set; }
    public string Kind { get; set; } = "update";
    public string Body { get; set; } = "";
    public string? Title { get; set; }
    public Guid CreatedById { get; set; }
    public User? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateOnly WeekStart { get; set; }
    public List<Comment> Comments { get; set; } = new();
}

public class Comment
{
    public Guid Id { get; set; }
    public Guid PostId { get; set; }
    public Post? Post { get; set; }
    public string Body { get; set; } = "";
    public Guid CreatedById { get; set; }
    public User? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class Sticky
{
    public Guid Id { get; set; }
    public double X { get; set; }
    public double Y { get; set; }
    public string Color { get; set; } = "s-y";
    public string Text { get; set; } = "";
    public string? DrawBlob { get; set; }
    public Guid? PinnedUserId { get; set; }
    public User? PinnedUser { get; set; }
    public Guid CreatedById { get; set; }
    public User? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class Kudos
{
    public Guid Id { get; set; }
    public Guid ToUserId { get; set; }
    public User? ToUser { get; set; }
    public Guid FromUserId { get; set; }
    public User? FromUser { get; set; }
    public string Body { get; set; } = "";
    public DateOnly WeekStart { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class Mention
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public string SourceType { get; set; } = "";
    public Guid SourceId { get; set; }
    public string Snippet { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

public class Audit
{
    public Guid Id { get; set; }
    public Guid? ActorId { get; set; }
    public User? Actor { get; set; }
    public string Action { get; set; } = "";
    public string ObjectType { get; set; } = "";
    public Guid? ObjectId { get; set; }
    public Guid? ClientId { get; set; }
    public string? BeforeJson { get; set; }
    public string? AfterJson { get; set; }
    public string? Reason { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AccessToken
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string? Contact { get; set; }
    public bool Internal { get; set; }
    public string Hash { get; set; } = "";
    public string PrefixHint { get; set; } = "";
    public bool Enabled { get; set; } = true;
    public DateTime CreatedAt { get; set; }
}

public class CompanySettings
{
    public Guid Id { get; set; }
    public string CompanyName { get; set; } = "BIS Consultants";
    public bool ShowPresence { get; set; } = true;
    public int IdleMinutes { get; set; } = 15;
    public bool CompressPhotos { get; set; } = true;
    public bool AllowDocuments { get; set; } = true;
    public int MaxUploadMb { get; set; } = 25;
    public bool SsoEnabled { get; set; }
    public string? SsoProvider { get; set; }
    public bool GeofenceOffice { get; set; }
    public string? OfficeAddress { get; set; }
    public string TimeZone { get; set; } = "America/Chicago";
}
