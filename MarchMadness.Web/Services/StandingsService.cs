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

        public async Task<List<BracketStanding>> GetStandingsAsync(string sport, int year = 2025)
        {
            var brackets = await _context.Brackets
                .Include(b => b.User)
                .Where(b => b.Sport == sport && b.Year == year)
                .ToListAsync();

            var standings = new List<BracketStanding>();

            foreach (var bracket in brackets)
            {
                var points = await CalculateBracketPointsAsync(bracket.Id);
                standings.Add(new BracketStanding
                {
                    BracketId = bracket.Id,
                    BracketName = bracket.BracketName,
                    UserName = bracket.User.Name,
                    TotalPoints = points,
                    SubmittedDate = bracket.SubmittedDate,
                    Sport = sport
                });
            }

            return standings.OrderByDescending(s => s.TotalPoints)
                           .ThenBy(s => s.SubmittedDate)
                           .Select((s, index) => { s.Rank = index + 1; return s; })
                           .ToList();
        }

        public async Task<int> CalculateBracketPointsAsync(int bracketId)
        {
            var bracket = await _context.Brackets.FindAsync(bracketId);
            if (bracket == null) return 0;

            var picks = await _context.Picks
                .Include(p => p.Game)
                .Where(p => p.BracketId == bracketId)
                .ToListAsync();

            int totalPoints = 0;

            foreach (var pick in picks)
            {
                // Only count if game has a winner
                if (pick.Game.WinnerId.HasValue && pick.PickedTeamId == pick.Game.WinnerId)
                {
                    // Points based on round: Round 1=1, Round 2=2, Round 3=4, Round 4=8, Round 5=16, Round 6=32
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

        public async Task RecalculateBracketsForSportAsync(string sport, int year = 2025)
        {
            var brackets = await _context.Brackets
                .Where(b => b.Sport == sport && b.Year == year)
                .ToListAsync();

            foreach (var bracket in brackets)
            {
                await CalculateBracketPointsAsync(bracket.Id);
            }
        }
    }

    public class BracketStanding
    {
        public int Rank { get; set; }
        public int BracketId { get; set; }
        public string BracketName { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
        public int TotalPoints { get; set; }
        public DateTime SubmittedDate { get; set; }
        public string Sport { get; set; } = string.Empty;
    }
}
