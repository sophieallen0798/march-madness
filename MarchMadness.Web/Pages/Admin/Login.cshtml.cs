using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.Security.Claims;
using MarchMadness.Web.Services;

namespace MarchMadness.Web.Pages.Admin
{
    [AllowAnonymous]
    public class LoginModel : PageModel
    {
        private readonly SupabaseAuthService _authService;

        public LoginModel(SupabaseAuthService authService)
        {
            _authService = authService;
        }

        [BindProperty]
        public string Email { get; set; } = string.Empty;

        [BindProperty]
        public string Password { get; set; } = string.Empty;

        public string? ErrorMessage { get; set; }

        public void OnGet()
        {
        }

        public async Task<IActionResult> OnPostAsync(string? returnUrl = null)
        {
            if (string.IsNullOrWhiteSpace(Email) || string.IsNullOrWhiteSpace(Password))
            {
                ErrorMessage = "Please provide email and password.";
                return Page();
            }

            var result = await _authService.SignInAsync(Email, Password);
            if (!result.Success)
            {
                ErrorMessage = "Sign-in failed: " + (result.Error ?? "unknown");
                return Page();
            }

            // Create cookie principal from Supabase user info
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Name, result.Email ?? Email),
                new Claim("email", result.Email ?? Email),
            };
            if (!string.IsNullOrEmpty(result.UserId)) claims.Add(new Claim("sub", result.UserId));

            var id = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(id));

            if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl))
                return LocalRedirect(returnUrl);

            return RedirectToPage("/Index");
        }
    }
}
