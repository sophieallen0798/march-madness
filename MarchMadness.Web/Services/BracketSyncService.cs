using Microsoft.EntityFrameworkCore;
using MarchMadness.Web.Data;
using MarchMadness.Web.Models;
using MarchMadness.Web.Models.Api;

namespace MarchMadness.Web.Services
{
    public class BracketSyncService
    {
        private readonly MarchMadnessContext _context;
        private readonly NcaaApiClient _apiClient;
        private readonly ILogger<BracketSyncService> _logger;

        public BracketSyncService(
            MarchMadnessContext context,
            NcaaApiClient apiClient,
            ILogger<BracketSyncService> logger)
        {
            _context = context;
            _apiClient = apiClient;
            _logger = logger;
        }

        public async Task SyncBracketDataAsync(string sport, int year = 2025)
        {
            _logger.LogInformation("Starting bracket sync for {Sport} {Year}", sport, year);

            var bracketData = await _apiClient.GetBracketInfoAsync(sport, year);
            if (bracketData?.Championships == null || !bracketData.Championships.Any())
            {
                _logger.LogWarning("No bracket data available for {Sport} {Year}", sport, year);
                return;
            }

            var championship = bracketData.Championships.First();

            // Sync teams from bracket data
            await SyncTeamsAsync(championship, sport, year);

            // Sync games
            await SyncGamesAsync(championship, sport, year);

            _logger.LogInformation("Bracket sync completed for {Sport} {Year}", sport, year);
        }

        private async Task SyncTeamsAsync(Championship championship, string sport, int year)
        {
            var allTeamsFromApi = championship.Games
                .SelectMany(g => g.Teams)
                .Where(t => !string.IsNullOrEmpty(t.SeoName))
                .GroupBy(t => t.SeoName)
                .Select(g => g.First())
                .ToList();

            _logger.LogInformation("Found {Count} unique teams in bracket", allTeamsFromApi.Count);

            foreach (var apiTeam in allTeamsFromApi)
            {
                var existingTeam = await _context.Teams
                    .FirstOrDefaultAsync(t => t.SeoName == apiTeam.SeoName 
                                              && t.Sport == sport 
                                              && t.Year == year);

                if (existingTeam == null)
                {
                    var team = new Team
                    {
                        Name = apiTeam.NameShort,
                        NameFull = apiTeam.NameFull,
                        NameShort = apiTeam.NameShort,
                        SeoName = apiTeam.SeoName,
                        Seed = apiTeam.Seed,
                        LogoUrl = apiTeam.LogoUrl,
                        Sport = sport,
                        Year = year
                    };
                    _context.Teams.Add(team);
                }
                else
                {
                    // Update existing team info
                    existingTeam.Seed = apiTeam.Seed;
                    existingTeam.LogoUrl = apiTeam.LogoUrl;
                }
            }

            await _context.SaveChangesAsync();
            _logger.LogInformation("Teams synced successfully");
        }

        private async Task SyncGamesAsync(Championship championship, string sport, int year)
        {
            _logger.LogInformation("Syncing {Count} games", championship.Games.Count);

            foreach (var apiGame in championship.Games)
            {
                var existingGame = await _context.Games
                    .Include(g => g.Team1)
                    .Include(g => g.Team2)
                    .FirstOrDefaultAsync(g => g.ContestId == apiGame.ContestId && g.Sport == sport && g.Year == year);

                if (existingGame == null)
                {
                    // Parse round number from first digit of bracketId
                    var roundNumber = apiGame.BracketId / 100;
                    
                    // Map sectionId to region name
                    var regionName = MapSectionIdToRegion(apiGame.SectionId, championship);
                    
                    var game = new Game
                    {
                        ContestId = apiGame.ContestId,
                        BracketPositionId = apiGame.BracketPositionId,
                        BracketId = apiGame.BracketId,
                        VictorBracketPositionId = apiGame.VictorBracketPositionId,
                        Round = roundNumber,
                        Region = regionName,
                        GameState = apiGame.GameState,
                        CurrentPeriod = apiGame.CurrentPeriod,
                        Title = apiGame.Title,
                        Sport = sport,
                        Year = year
                    };

                    // Set start time if available
                    if (apiGame.StartTimeEpoch.HasValue)
                    {
                        game.StartTime = DateTimeOffset.FromUnixTimeSeconds(apiGame.StartTimeEpoch.Value).UtcDateTime;
                    }

                    // Link teams
                    if (apiGame.Teams.Count >= 2)
                    {
                        var team1 = apiGame.Teams.FirstOrDefault(t => t.IsTop);
                        var team2 = apiGame.Teams.FirstOrDefault(t => !t.IsTop);

                        if (team1 != null)
                        {
                            var dbTeam1 = await _context.Teams.FirstOrDefaultAsync(t => t.SeoName == team1.SeoName && t.Sport == sport && t.Year == year);
                            if (dbTeam1 != null)
                            {
                                game.Team1Id = dbTeam1.Id;
                                game.Team1Score = team1.Score;
                                if (team1.IsWinner) game.WinnerId = dbTeam1.Id;
                            }
                        }

                        if (team2 != null)
                        {
                            var dbTeam2 = await _context.Teams.FirstOrDefaultAsync(t => t.SeoName == team2.SeoName && t.Sport == sport && t.Year == year);
                            if (dbTeam2 != null)
                            {
                                game.Team2Id = dbTeam2.Id;
                                game.Team2Score = team2.Score;
                                if (team2.IsWinner) game.WinnerId = dbTeam2.Id;
                            }
                        }
                    }

                    _context.Games.Add(game);
                }
                else
                {
                    // Update existing game state, scores, and winner
                    existingGame.GameState = apiGame.GameState;
                    existingGame.CurrentPeriod = apiGame.CurrentPeriod;

                    if (apiGame.Teams.Count >= 2)
                    {
                        var team1 = apiGame.Teams.FirstOrDefault(t => t.IsTop);
                        var team2 = apiGame.Teams.FirstOrDefault(t => !t.IsTop);

                        if (team1 != null)
                        {
                            existingGame.Team1Score = team1.Score;
                            if (team1.IsWinner && existingGame.Team1Id.HasValue)
                            {
                                existingGame.WinnerId = existingGame.Team1Id.Value;
                            }
                        }

                        if (team2 != null)
                        {
                            existingGame.Team2Score = team2.Score;
                            if (team2.IsWinner && existingGame.Team2Id.HasValue)
                            {
                                existingGame.WinnerId = existingGame.Team2Id.Value;
                            }
                        }
                    }
                }
            }

            await _context.SaveChangesAsync();
            _logger.LogInformation("Games synced successfully");
        }

        public async Task UpdateScoresAsync(string sport)
        {
            var scoreboard = await _apiClient.GetScoreboardAsync(sport);
            if (scoreboard?.Games == null) return;

            foreach (var scoreGame in scoreboard.Games)
            {
                var game = scoreGame.Game;
                if (string.IsNullOrEmpty(game.GameId)) continue;

                var existingGame = await _context.Games
                    .FirstOrDefaultAsync(g => g.ContestId.ToString() == game.GameId);

                if (existingGame != null)
                {
                    existingGame.GameState = game.GameState;
                    existingGame.CurrentPeriod = game.CurrentPeriod;

                    if (game.Home != null && int.TryParse(game.Home.Score, out var homeScore))
                    {
                        existingGame.Team1Score = homeScore;
                    }

                    if (game.Away != null && int.TryParse(game.Away.Score, out var awayScore))
                    {
                        existingGame.Team2Score = awayScore;
                    }
                }
            }

            await _context.SaveChangesAsync();
            _logger.LogInformation("Scores updated for {Sport}", sport);
        }

        private string MapSectionIdToRegion(int sectionId, Championship championship)
        {
            _logger.LogInformation("Mapping sectionId {SectionId} to region name...", sectionId);
            if (championship.Regions != null && championship.Regions.Any())
            {
                var region = championship.Regions.FirstOrDefault(r => r.SectionId == sectionId);
                if (region != null)
                {
                    if (region.RegionCode == "CC")
                        return "Final";

                    if (!string.IsNullOrEmpty(region.Title))
                        return region.Title;
                }
            }

            return $"Region{sectionId}";
        }
    }
}
