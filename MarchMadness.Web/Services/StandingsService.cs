using MarchMadness.Web.Data;
using MarchMadness.Web.Models;
using Microsoft.EntityFrameworkCore;

namespace MarchMadness.Web.Services
{
    public class StandingsService
    {
        private readonly MarchMadnessContext _context;

        public StandingsService(MarchMadnessContext context)
        {
            _context = context;
        }

        public async Task<List<BracketStanding>> GetStandingsAsync()
        {
            var brackets = await _context.Brackets
                .Include(b => b.User)
                .OrderByDescending(b => b.TotalPoints)
                .ThenBy(b => b.SubmittedDate)
                .ToListAsync();

            var standings = new List<BracketStanding>();
            int rank = 1;

            foreach (var bracket in brackets)
            {
                var points = await CalculateBracketPointsAsync(bracket.Id);
                standings.Add(new BracketStanding
                {
                    Rank = rank++,
                    BracketName = bracket.BracketName,
                    UserName = bracket.User.Name,
                    TotalPoints = points,
                    SubmittedDate = bracket.SubmittedDate
                });
            }

            return standings;
        }

        public async Task<int> CalculateBracketPointsAsync(int bracketId)
        {
            var bracket = await _context.Brackets.FindAsync(bracketId);
            if (bracket == null) return 0;

            var picks = await _context.Picks
                .Include(p => p.Game)
                .Where(p => p.UserId == bracket.UserId)
                .ToListAsync();

            int totalPoints = 0;

            foreach (var pick in picks)
            {
                if (pick.Game.WinnerId.HasValue && pick.PickedTeamId == pick.Game.WinnerId)
                {
                    // Points based on round: 1, 2, 4, 8, 16, 32
                    int roundPoints = (int)Math.Pow(2, pick.Game.Round - 1);
                    totalPoints += roundPoints;
                }
            }

            // Update bracket total
            bracket.TotalPoints = totalPoints;
            await _context.SaveChangesAsync();

            return totalPoints;
        }

        public async Task RecalculateAllBracketsAsync()
        {
            var brackets = await _context.Brackets.ToListAsync();
            foreach (var bracket in brackets)
            {
                await CalculateBracketPointsAsync(bracket.Id);
            }
        }
    }

    public class BracketStanding
    {
        public int Rank { get; set; }
        public string BracketName { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
        public int TotalPoints { get; set; }
        public DateTime SubmittedDate { get; set; }
    }
}
