using Bis.Admin.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bis.Admin.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<County> Counties => Set<County>();
    public DbSet<Client> Clients => Set<Client>();
    public DbSet<Person> People => Set<Person>();
    public DbSet<Address> Addresses => Set<Address>();
    public DbSet<ServiceType> ServiceTypes => Set<ServiceType>();
    public DbSet<ClientService> ClientServices => Set<ClientService>();
    public DbSet<Link> Links => Set<Link>();
    public DbSet<Vendor> Vendors => Set<Vendor>();
    public DbSet<Credential> Credentials => Set<Credential>();
    public DbSet<FlagLevel> FlagLevels => Set<FlagLevel>();
    public DbSet<Flag> Flags => Set<Flag>();
    public DbSet<Attachment> Attachments => Set<Attachment>();
    public DbSet<Note> Notes => Set<Note>();
    public DbSet<CustomFieldDef> CustomFieldDefs => Set<CustomFieldDef>();
    public DbSet<Punch> Punches => Set<Punch>();
    public DbSet<Post> Posts => Set<Post>();
    public DbSet<Comment> Comments => Set<Comment>();
    public DbSet<PostThumb> PostThumbs => Set<PostThumb>();
    public DbSet<Sticky> Stickies => Set<Sticky>();
    public DbSet<Kudos> Kudos => Set<Kudos>();
    public DbSet<Mention> Mentions => Set<Mention>();
    public DbSet<Audit> Audits => Set<Audit>();
    public DbSet<AccessToken> AccessTokens => Set<AccessToken>();
    public DbSet<CompanySettings> CompanySettings => Set<CompanySettings>();
    public DbSet<Shoutout> Shoutouts => Set<Shoutout>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<User>(e =>
        {
            e.HasIndex(x => x.Email).IsUnique();
            e.HasOne(x => x.Manager).WithMany().HasForeignKey(x => x.ManagerId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(x => x.Department).WithMany().HasForeignKey(x => x.DepartmentId);
        });
        model.Entity<Client>(e =>
        {
            e.HasMany(x => x.People).WithOne(x => x.Client).HasForeignKey(x => x.ClientId);
            e.HasMany(x => x.Addresses).WithOne(x => x.Client).HasForeignKey(x => x.ClientId);
            e.HasMany(x => x.Services).WithOne(x => x.Client).HasForeignKey(x => x.ClientId);
            e.HasMany(x => x.Links).WithOne(x => x.Client).HasForeignKey(x => x.ClientId);
            e.HasMany(x => x.Vendors).WithOne(x => x.Client).HasForeignKey(x => x.ClientId);
            e.HasMany(x => x.Credentials).WithOne(x => x.Client).HasForeignKey(x => x.ClientId);
            e.HasMany(x => x.Flags).WithOne(x => x.Client).HasForeignKey(x => x.ClientId);
            e.HasMany(x => x.Attachments).WithOne(x => x.Client).HasForeignKey(x => x.ClientId);
            e.HasMany(x => x.Notes).WithOne(x => x.Client).HasForeignKey(x => x.ClientId);
        });
        model.Entity<Credential>(e =>
        {
            e.Ignore("SecretPlain");
        });
        model.Entity<Audit>(e =>
        {
            e.HasIndex(x => x.CreatedAt);
        });
        model.Entity<AccessToken>(e =>
        {
            e.HasIndex(x => x.Hash);
        });
        model.Entity<Flag>(e =>
        {
            e.HasOne(x => x.CreatedBy).WithMany().HasForeignKey(x => x.CreatedById).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<Post>(e =>
        {
            e.HasOne(x => x.CreatedBy).WithMany().HasForeignKey(x => x.CreatedById).OnDelete(DeleteBehavior.Restrict);
            e.HasMany(x => x.Thumbs).WithOne(x => x.Post).HasForeignKey(x => x.PostId);
        });
        model.Entity<PostThumb>(e =>
        {
            e.HasIndex(x => new { x.PostId, x.UserId }).IsUnique();
        });
        model.Entity<Comment>(e =>
        {
            e.HasOne(x => x.CreatedBy).WithMany().HasForeignKey(x => x.CreatedById).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<Kudos>(e =>
        {
            e.HasOne(x => x.ToUser).WithMany().HasForeignKey(x => x.ToUserId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.FromUser).WithMany().HasForeignKey(x => x.FromUserId).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<Shoutout>(e =>
        {
            e.HasOne(x => x.FromUser).WithMany().HasForeignKey(x => x.FromUserId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.CreatedAt);
            e.HasIndex(x => new { x.FromUserId, x.CreatedAt });
            e.Property(x => x.Text).HasMaxLength(ShoutoutRules.MaxText);
            e.Property(x => x.Preset).HasMaxLength(40);
            e.Property(x => x.Emoji).HasMaxLength(16);
        });
    }
}
