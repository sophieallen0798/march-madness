using System.Collections.Concurrent;

namespace MarchMadness.Web.Services
{
    public class ScoresUpdateTracker
    {
        private readonly ConcurrentDictionary<string, DateTime> _timestamps = new();

        public void SetLastUpdatedUtc(string sport, DateTime utc)
        {
            _timestamps.AddOrUpdate(sport ?? "", utc, (_, __) => utc);
        }

        public DateTime? GetLastUpdatedUtc(string sport)
        {
            if (sport == null) return null;
            return _timestamps.TryGetValue(sport, out var dt) ? dt : (DateTime?)null;
        }
    }
}
