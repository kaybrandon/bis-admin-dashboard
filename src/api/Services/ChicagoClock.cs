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

    public static bool InBirthdayWindow(DateOnly birthday, DateOnly today) => InCelebrationWindow(birthday, today);

    /// <summary>Yesterday / today / tomorrow on the month-day, America/Chicago calendar.</summary>
    public static bool InCelebrationWindow(DateOnly date, DateOnly today)
    {
        static int Doy(DateOnly d) => d.DayOfYear;
        var b = new DateOnly(today.Year, date.Month, Math.Min(date.Day, DateTime.DaysInMonth(today.Year, date.Month)));
        var yesterday = today.AddDays(-1);
        var tomorrow = today.AddDays(1);
        return b == yesterday || b == today || b == tomorrow || Doy(b) == Doy(yesterday) || Doy(b) == Doy(tomorrow);
    }

    /// <summary>Month/day required. Year optional; omitted years use 1 (or 2000 for 29 Feb).</summary>
    public static bool TryComposeBirthday(int month, int day, int? year, out DateOnly birthday, out string? error)
    {
        birthday = default;
        error = null;
        var y = year is >= 1900 and <= 9999 ? year.Value : 1;
        if (month == 2 && day == 29 && DateTime.DaysInMonth(y, 2) < 29)
            y = 2000;
        try
        {
            birthday = new DateOnly(y, month, day);
            return true;
        }
        catch (ArgumentOutOfRangeException)
        {
            error = "Invalid birthday month/day.";
            return false;
        }
    }

    public static bool TryParseBirthday(string value, out DateOnly birthday, out string? error)
    {
        birthday = default;
        error = null;
        var s = value.Trim();
        if (DateOnly.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.None, out birthday))
            return true;
        if (s.Length == 5 && s[2] == '-'
            && int.TryParse(s.AsSpan(0, 2), out var month)
            && int.TryParse(s.AsSpan(3, 2), out var day))
            return TryComposeBirthday(month, day, null, out birthday, out error);
        error = "Birthday must be YYYY-MM-DD or MM-DD.";
        return false;
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
