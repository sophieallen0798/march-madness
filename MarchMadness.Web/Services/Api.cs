using System.Text.Json;
using MarchMadness.Web.Models.Api;

namespace MarchMadness.Web.Services
{
    public class NcaaApiClient
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<NcaaApiClient> _logger;
        private const string BaseUrl = "https://ncaa-api.henrygd.me";

        public NcaaApiClient(HttpClient httpClient, ILogger<NcaaApiClient> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
        }

        public async Task<BracketApiResponse?> GetBracketInfoAsync(string sport, int year = 2025)
        {
            try
            {
                var url = $"{BaseUrl}/brackets/{sport}/d1/{year}";
                _logger.LogInformation("Fetching bracket info from {Url}", url);
                var json = await _httpClient.GetStringAsync(url);
                return JsonSerializer.Deserialize<BracketApiResponse>(json, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching bracket info for {Sport} {Year}", sport, year);
                return null;
            }
        }

        public async Task<ScoreboardApiResponse?> GetScoreboardAsync(string sport)
        {
            try
            {
                var url = $"{BaseUrl}/scoreboard/{sport}/d1";
                _logger.LogInformation("Fetching scoreboard from {Url}", url);
                var json = await _httpClient.GetStringAsync(url);
                return JsonSerializer.Deserialize<ScoreboardApiResponse>(json, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching scoreboard for {Sport}", sport);
                return null;
            }
        }

        public async Task<RankingsApiResponse?> GetRankingsAsync(string sport)
        {
            try
            {
                var url = $"{BaseUrl}/rankings/{sport}/d1/associated-press";
                _logger.LogInformation("Fetching rankings from {Url}", url);
                var json = await _httpClient.GetStringAsync(url);
                return JsonSerializer.Deserialize<RankingsApiResponse>(json, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching rankings for {Sport}", sport);
                return null;
            }
        }

        public async Task<StandingsApiResponse?> GetStandingsAsync(string sport)
        {
            try
            {
                var url = $"{BaseUrl}/standings/{sport}/d1";
                _logger.LogInformation("Fetching standings from {Url}", url);
                var json = await _httpClient.GetStringAsync(url);
                return JsonSerializer.Deserialize<StandingsApiResponse>(json, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching standings for {Sport}", sport);
                return null;
            }
        }
    }
}