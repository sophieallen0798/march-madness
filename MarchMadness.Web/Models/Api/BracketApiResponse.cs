using System.Text.Json.Serialization;

namespace MarchMadness.Web.Models.Api
{
    public class BracketApiResponse
    {
        [JsonPropertyName("championships")]
        public List<Championship> Championships { get; set; } = new();
    }

    public class Championship
    {
        [JsonPropertyName("title")]
        public string Title { get; set; } = string.Empty;

        [JsonPropertyName("year")]
        public int Year { get; set; }

        [JsonPropertyName("sportUrl")]
        public string SportUrl { get; set; } = string.Empty;

        [JsonPropertyName("championshipId")]
        public int ChampionshipId { get; set; }

        [JsonPropertyName("games")]
        public List<ApiGame> Games { get; set; } = new();

        [JsonPropertyName("rounds")]
        public List<Round> Rounds { get; set; } = new();

        [JsonPropertyName("regions")]
        public List<Region> Regions { get; set; } = new();
    }

    public class ApiGame
    {
        [JsonPropertyName("contestId")]
        public int ContestId { get; set; }

        [JsonPropertyName("bracketPositionId")]
        public int BracketPositionId { get; set; }

        [JsonPropertyName("bracketId")]
        public int BracketId { get; set; }

        [JsonPropertyName("victorBracketPositionId")]
        public int? VictorBracketPositionId { get; set; }

        [JsonPropertyName("gameState")]
        public string GameState { get; set; } = string.Empty;

        [JsonPropertyName("currentPeriod")]
        public string CurrentPeriod { get; set; } = string.Empty;

        [JsonPropertyName("startDate")]
        public string StartDate { get; set; } = string.Empty;

        [JsonPropertyName("startTime")]
        public string StartTime { get; set; } = string.Empty;

        [JsonPropertyName("startTimeEpoch")]
        public long? StartTimeEpoch { get; set; }

        [JsonPropertyName("sectionId")]
        public int SectionId { get; set; }

        [JsonPropertyName("title")]
        public string Title { get; set; } = string.Empty;

        [JsonPropertyName("teams")]
        public List<ApiTeam> Teams { get; set; } = new();
    }

    public class ApiTeam
    {
        [JsonPropertyName("isTop")]
        public bool IsTop { get; set; }

        [JsonPropertyName("isWinner")]
        public bool IsWinner { get; set; }

        [JsonPropertyName("score")]
        public int Score { get; set; }

        [JsonPropertyName("seed")]
        public int Seed { get; set; }

        [JsonPropertyName("nameShort")]
        public string NameShort { get; set; } = string.Empty;

        [JsonPropertyName("nameFull")]
        public string NameFull { get; set; } = string.Empty;

        [JsonPropertyName("seoname")]
        public string SeoName { get; set; } = string.Empty;

        [JsonPropertyName("logoUrl")]
        public string LogoUrl { get; set; } = string.Empty;
    }

    public class Round
    {
        [JsonPropertyName("roundNumber")]
        public int RoundNumber { get; set; }

        [JsonPropertyName("title")]
        public string Title { get; set; } = string.Empty;
    }

    public class Region
    {
        [JsonPropertyName("regionCode")]
        public string RegionCode { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;
    }
}
