using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using MarchMadness.Web.Data;
using MarchMadness.Web.Models;
using MarchMadness.Web.Pages.Shared;

namespace MarchMadness.Web.Pages
{
    public class MyBracketModel : PageModel
    {
        private readonly MarchMadnessContext _context;

        public MyBracketModel(MarchMadnessContext context)
        {
            _context = context;
        }

        public string Sport { get; set; } = "basketball-men";
        public Bracket? UserBracket { get; set; }
        public List<ScoringGameCardModel> ScoringGames { get; set; } = new();
        public bool HasBracket => UserBracket != null;
        public string? ErrorMessage { get; set; }
        public string UserName { get; set; } = string.Empty;
        public List<BracketOption> AvailableBrackets { get; set; } = new();

        public async Task OnGetAsync(string sport = "basketball-men", int? bracketId = null)
        {
            Sport = sport;

            if (bracketId.HasValue)
            {
                UserBracket = await _context.Brackets
                    .Include(b => b.User)
                    .FirstOrDefaultAsync(b => b.Id == bracketId.Value);
            }
            else
            {
                // Try to find bracket via Supabase JWT (AuthUserId stored in users.auth_user_id)
                var authUserId = User.FindFirst("sub")?.Value;
                if (!string.IsNullOrEmpty(authUserId))
                {
                    var user = await _context.Users
                        .FirstOrDefaultAsync(u => u.AuthUserId == authUserId);

                    if (user == null)
                    {
                        // Create a user record for this authenticated user
                        user = new User
                        {
                            Name = User.FindFirst("email")?.Value ?? User.Identity?.Name ?? "Supabase User",
                            AuthUserId = authUserId
                        };
                        _context.Users.Add(user);
                        await _context.SaveChangesAsync();
                    }

                    UserBracket = await _context.Brackets
                        .Include(b => b.User)
                        .FirstOrDefaultAsync(b => b.UserId == user.Id && b.Sport == sport && b.Year == 2025);
                }
            }

            // Load all available brackets for the selector
            AvailableBrackets = await _context.Brackets
                .Include(b => b.User)
                .Where(b => b.Sport == Sport && b.Year == 2025)
                .OrderBy(b => b.User.Name)
                .Select(b => new BracketOption { Id = b.Id, Name = b.BracketName, UserName = b.User.Name })
                .ToListAsync();

            if (UserBracket != null)
            {
                UserName = UserBracket.User.Name;
                await BuildScoringBracketAsync();
            }
        }

        private async Task BuildScoringBracketAsync()
        {
            // Load all bracket games (Round 2+)
            var allGames = await _context.Games
                .Include(g => g.Team1)
                .Include(g => g.Team2)
                .Where(g => g.Sport == Sport && g.Year == 2025 && g.Round >= 2)
                .OrderBy(g => g.Round)
                .ThenBy(g => g.BracketPositionId)
                .ToListAsync();

            // Load user's picks
            var picks = await _context.Picks
                .Where(p => p.BracketId == UserBracket!.Id)
                .ToListAsync();

            var picksByGame = picks.ToDictionary(p => p.GameId, p => p.PickedTeamId);

            // Load all teams for lookup
            var allTeams = await _context.Teams
                .Where(t => t.Sport == Sport && t.Year == 2025)
                .ToDictionaryAsync(t => t.Id);

            // Build scoring cards: round 2 uses actual teams, later rounds use user's picks from feeder games
            foreach (var game in allGames)
            {
                Team? team1 = null, team2 = null;

                if (game.Round == 2)
                {
                    // First round of 64 - teams come from the database
                    team1 = game.Team1;
                    team2 = game.Team2;
                }
                else
                {
                    // Find the two feeder games that advance winners to this game
                    var feeders = allGames
                        .Where(g => g.VictorBracketPositionId == game.BracketPositionId)
                        .OrderBy(g => g.BracketPositionId)
                        .ToList();

                    if (feeders.Count >= 1 && picksByGame.TryGetValue(feeders[0].Id, out var pick1))
                        allTeams.TryGetValue(pick1, out team1);
                    if (feeders.Count >= 2 && picksByGame.TryGetValue(feeders[1].Id, out var pick2))
                        allTeams.TryGetValue(pick2, out team2);
                }

                ScoringGames.Add(new ScoringGameCardModel
                {
                    GameId = game.Id,
                    BracketPositionId = game.BracketPositionId,
                    VictorBracketPositionId = game.VictorBracketPositionId,
                    Region = game.Region,
                    Team1 = team1,
                    Team2 = team2,
                    PickedTeamId = picksByGame.TryGetValue(game.Id, out var pickedId) ? (int?)pickedId : null,
                    ActualWinnerId = game.WinnerId,
                    GameState = game.GameState,
                    StartTime = game.StartTime,
                    Round = game.Round
                });
            }
        }
    }

    public class BracketOption
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
    }
}
