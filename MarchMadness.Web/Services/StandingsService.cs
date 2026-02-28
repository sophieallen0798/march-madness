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

            // Build set of eliminated team IDs (lost in any completed game)
            var decidedGames = await _context.Games
                .Where(g => g.Sport == sport && g.Year == year && g.WinnerId.HasValue)
                .Select(g => new { g.Team1Id, g.Team2Id, g.WinnerId })
                .ToListAsync();

            var eliminatedSet = new HashSet<int>();
            foreach (var g in decidedGames)
            {
                if (g.Team1Id.HasValue && g.Team1Id != g.WinnerId)
                    eliminatedSet.Add(g.Team1Id.Value);
                if (g.Team2Id.HasValue && g.Team2Id != g.WinnerId)
                    eliminatedSet.Add(g.Team2Id.Value);
            }

            var standings = new List<BracketStanding>();

            foreach (var bracket in brackets)
            {
                // Load all picks with their games in one query
                var picks = await _context.Picks
                    .Include(p => p.Game)
                    .Include(p => p.PickedTeam)
                    .Where(p => p.BracketId == bracket.Id)
                    .ToListAsync();

                int totalPoints = 0;
                int pointsPossible = 0;
                string? championName = null;

                foreach (var pick in picks)
                {
                    int roundPoints = (int)Math.Pow(2, pick.Game.Round - 1);

                    if (pick.Game.WinnerId.HasValue)
                    {
                        // Game decided: count if pick was correct
                        if (pick.PickedTeamId == pick.Game.WinnerId)
                        {
                            totalPoints += roundPoints;
                            pointsPossible += roundPoints;
                        }
                    }
                    else
                    {
                        // Game not decided: count as possible if picked team is still alive
                        if (!eliminatedSet.Contains(pick.PickedTeamId))
                            pointsPossible += roundPoints;
                    }

                    // Capture championship pick
                    if (pick.Game.Round == 7)
                        championName = pick.PickedTeam?.NameShort;
                }

                // Persist total points
                bracket.TotalPoints = totalPoints;

                standings.Add(new BracketStanding
                {
                    BracketId = bracket.Id,
                    BracketName = bracket.BracketName,
                    UserName = bracket.User.Name,
                    TotalPoints = totalPoints,
                    PointsPossible = pointsPossible,
                    SubmittedDate = bracket.SubmittedDate,
                    Sport = sport,
                    ChampionPick = championName ?? "—"
                });
            }

            await _context.SaveChangesAsync();

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
        public int PointsPossible { get; set; }
        public DateTime SubmittedDate { get; set; }
        public string Sport { get; set; } = string.Empty;
        public string ChampionPick { get; set; } = string.Empty;
    }
}
