using Microsoft.EntityFrameworkCore;
using MarchMadness.Web.Models;

namespace MarchMadness.Web.Data
{
    public class MarchMadnessContext : DbContext
    {
        public MarchMadnessContext(DbContextOptions<MarchMadnessContext> options)
            : base(options)
        {
        }

        public DbSet<Team> Teams { get; set; } = null!;
        public DbSet<Game> Games { get; set; } = null!;
        public DbSet<User> Users { get; set; } = null!;
        public DbSet<Pick> Picks { get; set; } = null!;
        public DbSet<Bracket> Brackets { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Game>()
                .HasOne(g => g.Team1)
                .WithMany()
                .HasForeignKey(g => g.Team1Id)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Game>()
                .HasOne(g => g.Team2)
                .WithMany()
                .HasForeignKey(g => g.Team2Id)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Game>()
                .HasOne(g => g.Winner)
                .WithMany()
                .HasForeignKey(g => g.WinnerId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Pick>()
                .HasOne(p => p.Bracket)
                .WithMany()
                .HasForeignKey(p => p.BracketId);

            modelBuilder.Entity<Pick>()
                .HasOne(p => p.Game)
                .WithMany()
                .HasForeignKey(p => p.GameId);

            modelBuilder.Entity<Pick>()
                .HasOne(p => p.PickedTeam)
                .WithMany()
                .HasForeignKey(p => p.PickedTeamId);

            modelBuilder.Entity<Bracket>()
                .HasOne(b => b.User)
                .WithMany()
                .HasForeignKey(b => b.UserId);

            // Indexes for better query performance
            modelBuilder.Entity<Game>()
                .HasIndex(g => new { g.Sport, g.Year, g.ContestId });

            modelBuilder.Entity<Team>()
                .HasIndex(t => new { t.Sport, t.Year, t.SeoName });

            modelBuilder.Entity<Bracket>()
                .HasIndex(b => new { b.Sport, b.Year, b.UserId });
        }
    }
}
