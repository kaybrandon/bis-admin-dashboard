using System.Globalization;

namespace Bis.Admin.Api.Services;

public static class ChicagoClock
{
    public static TimeZoneInfo Zone { get; } = Resolve();

    public static DateTimeOffset Now => TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, Zone);

    public static DateOnly Today => DateOnly.FromDateTime(Now.DateTime);

    public static DateOnly WeekStart(DateTimeOffset? at = null)
    {
        var local = (at ?? Now).DateTime.Date;
        var delta = ((int)local.DayOfWeek + 6) % 7; // Monday = 0
        return DateOnly.FromDateTime(local.AddDays(-delta));
    }

    public static DateOnly WeekEnd(DateOnly weekStart) => weekStart.AddDays(6);

    public static DateOnly MonthStart => new(Today.Year, Today.Month, 1);

    public static DateTime ToUtc(DateTime localUnspecified)
    {
        var unspecified = DateTime.SpecifyKind(localUnspecified, DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(unspecified, Zone);
    }

    public static DateTimeOffset ToChicago(DateTime utc)
    {
        var u = utc.Kind == DateTimeKind.Utc ? utc : DateTime.SpecifyKind(utc, DateTimeKind.Utc);
        return TimeZoneInfo.ConvertTime(new DateTimeOffset(u), Zone);
    }

    public static bool InBirthdayWindow(DateOnly birthday, DateOnly today)
    {
        static int Doy(DateOnly d) => d.DayOfYear;
        var b = new DateOnly(today.Year, birthday.Month, Math.Min(birthday.Day, DateTime.DaysInMonth(today.Year, birthday.Month)));
        var yesterday = today.AddDays(-1);
        var tomorrow = today.AddDays(1);
        return b == yesterday || b == today || b == tomorrow || Doy(b) == Doy(yesterday) || Doy(b) == Doy(tomorrow);
    }

    public static string WeekLabel()
    {
        var start = WeekStart();
        var end = WeekEnd(start);
        var en = CultureInfo.GetCultureInfo("en-US");
        var left = start.ToString("MMM d", en);
        var right = end.Month == start.Month
            ? end.Day.ToString(en)
            : end.ToString("MMM d", en);
        return $"{left}–{right} · America/Chicago";
    }

    private static TimeZoneInfo Resolve()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("America/Chicago"); }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Central Standard Time");
        }
    }
}
