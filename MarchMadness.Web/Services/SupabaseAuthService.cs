using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text.Json;

namespace MarchMadness.Web.Services
{
    public class SupabaseSignInResult
    {
        public bool Success { get; set; }
        public string? AccessToken { get; set; }
        public string? RefreshToken { get; set; }
        public string? UserId { get; set; }
        public string? Email { get; set; }
        public string? Error { get; set; }
    }

    public class SupabaseAuthService
    {
        private readonly IHttpClientFactory _httpFactory;
        private readonly IConfiguration _config;

        public SupabaseAuthService(IHttpClientFactory httpFactory, IConfiguration config)
        {
            _httpFactory = httpFactory;
            _config = config;
        }

        public async Task<SupabaseSignInResult> SignInAsync(string email, string password)
        {
            var supabaseUrl = _config["Supabase:Url"]?.TrimEnd('/') ?? string.Empty;
            var anonKey = _config["Supabase:AnonKey"] ?? string.Empty;
            if (string.IsNullOrEmpty(supabaseUrl) || string.IsNullOrEmpty(anonKey))
                return new SupabaseSignInResult { Success = false, Error = "Supabase not configured" };

            var client = _httpFactory.CreateClient();
            client.DefaultRequestHeaders.Add("apikey", anonKey);
            client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            var payload = new { email, password };
            var url = $"{supabaseUrl}/auth/v1/token?grant_type=password";

            var resp = await client.PostAsJsonAsync(url, payload);
            var result = new SupabaseSignInResult();
            var content = await resp.Content.ReadAsStringAsync();
            if (!resp.IsSuccessStatusCode)
            {
                result.Success = false;
                result.Error = content;
                return result;
            }

            using var doc = JsonDocument.Parse(content);
            var root = doc.RootElement;
            if (root.TryGetProperty("access_token", out var at)) result.AccessToken = at.GetString();
            if (root.TryGetProperty("refresh_token", out var rt)) result.RefreshToken = rt.GetString();
            if (root.TryGetProperty("user", out var userEl))
            {
                if (userEl.TryGetProperty("id", out var id)) result.UserId = id.GetString();
                if (userEl.TryGetProperty("email", out var e)) result.Email = e.GetString();
            }

            result.Success = !string.IsNullOrEmpty(result.AccessToken);
            return result;
        }
    }
}
