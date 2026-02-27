using MarchMadness.Web.Data;
using MarchMadness.Web.Models;
using MarchMadness.Web.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace MarchMadness.Tests.Services;

public class StandingsServiceTests
{
    private MarchMadnessContext GetInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<MarchMadnessContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new MarchMadnessContext(options);
    }

    [Fact]
    public async Task GetStandingsAsync_ReturnsEmpty_WhenNoBrackets()
    {
        // Arrange
        using var context = GetInMemoryContext();
        var service = new StandingsService(context);

        // Act
        var standings = await service.GetStandingsAsync("basketball-men", 2025);

        // Assert
        Assert.Empty(standings);
    }

    [Fact]
    public async Task GetStandingsAsync_CalculatesCorrectPoints_ForCorrectPicks()
    {
        // Arrange
        using var context = GetInMemoryContext();
        var user = new User { Id = 1, Name = "Test User", WindowsUsername = "testuser" };
        context.Users.Add(user);

        var bracket = new Bracket
        {
            Id = 1,
            UserId = 1,
            BracketName = "Test Bracket",
            Sport = "basketball-men",
            Year = 2025,
            SubmittedDate = DateTime.UtcNow
        };
        context.Brackets.Add(bracket);

        // Create actual games with winners
        var game1 = new Game
        {
            Id = 1,
            ContestId = 201,
            Sport = "basketball-men",
            Year = 2025,
            Round = 2,
            WinnerId = 1,
            GameState = "final"
        };
        var game2 = new Game
        {
            Id = 2,
            ContestId = 202,
            Sport = "basketball-men",
            Year = 2025,
            Round = 3,
            WinnerId = 1,
            GameState = "final"
        };
        context.Games.AddRange(game1, game2);

        // Create user picks (correct picks)
        var pick1 = new Pick
        {
            BracketId = 1,
            GameId = 1,
            PickedTeamId = 1 // Correct pick
        };
        var pick2 = new Pick
        {
            BracketId = 1,
            GameId = 2,
            PickedTeamId = 1 // Correct pick
        };
        context.Picks.AddRange(pick1, pick2);

        await context.SaveChangesAsync();

        var service = new StandingsService(context);

        // Act
        var standings = await service.GetStandingsAsync("basketball-men", 2025);

        // Assert
        Assert.Single(standings);
        var standing = standings[0];
        Assert.Equal("Test User", standing.UserName);
        Assert.Equal("Test Bracket", standing.BracketName);
        // Points: Round 2 = 2 points, Round 3 = 4 points = 6 total
        Assert.Equal(6, standing.TotalPoints);
    }

    [Fact]
    public async Task GetStandingsAsync_NoPoints_ForIncorrectPicks()
    {
        // Arrange
        using var context = GetInMemoryContext();
        var user = new User { Id = 1, Name = "Test User", WindowsUsername = "testuser" };
        context.Users.Add(user);

        var bracket = new Bracket
        {
            Id = 1,
            UserId = 1,
            BracketName = "Test Bracket",
            Sport = "basketball-men",
            Year = 2025,
            SubmittedDate = DateTime.UtcNow
        };
        context.Brackets.Add(bracket);

        // Create actual game with winner
        var game = new Game
        {
            Id = 1,
            ContestId = 201,
            Sport = "basketball-men",
            Year = 2025,
            Round = 2,
            WinnerId = 1,
            GameState = "final"
        };
        context.Games.Add(game);

        // Create user pick (incorrect pick)
        var pick = new Pick
        {
            BracketId = 1,
            GameId = 1,
            PickedTeamId = 2 // Wrong pick
        };
        context.Picks.Add(pick);

        await context.SaveChangesAsync();

        var service = new StandingsService(context);

        // Act
        var standings = await service.GetStandingsAsync("basketball-men", 2025);

        // Assert
        Assert.Single(standings);
        var standing = standings[0];
        Assert.Equal(0, standing.TotalPoints);
    }

    [Theory]
    [InlineData(2, 2)]   // First Round = 2^1 = 2 points
    [InlineData(3, 4)]   // Second Round = 2^2 = 4 points
    [InlineData(4, 8)]   // Sweet Sixteen = 2^3 = 8 points
    [InlineData(5, 16)]  // Elite Eight = 2^4 = 16 points
    [InlineData(6, 32)]  // Final Four = 2^5 = 32 points
    [InlineData(7, 64)]  // Championship = 2^6 = 64 points
    public async Task GetStandingsAsync_CorrectPointsByRound(int round, int expectedPoints)
    {
        // Arrange
        using var context = GetInMemoryContext();
        var user = new User { Id = 1, Name = "Test User", WindowsUsername = "testuser" };
        context.Users.Add(user);

        var bracket = new Bracket
        {
            Id = 1,
            UserId = 1,
            BracketName = "Test Bracket",
            Sport = "basketball-men",
            Year = 2025,
            SubmittedDate = DateTime.UtcNow
        };
        context.Brackets.Add(bracket);

        var game = new Game
        {
            Id = 1,
            ContestId = 201,
            Sport = "basketball-men",
            Year = 2025,
            Round = round,
            WinnerId = 1,
            GameState = "final"
        };
        context.Games.Add(game);

        var pick = new Pick
        {
            BracketId = 1,
            GameId = 1,
            PickedTeamId = 1 // Correct pick
        };
        context.Picks.Add(pick);

        await context.SaveChangesAsync();

        var service = new StandingsService(context);

        // Act
        var standings = await service.GetStandingsAsync("basketball-men", 2025);

        // Assert
        Assert.Single(standings);
        Assert.Equal(expectedPoints, standings[0].TotalPoints);
    }

    [Fact]
    public async Task GetStandingsAsync_OrdersByPoints_Descending()
    {
        // Arrange
        using var context = GetInMemoryContext();
        
        var user1 = new User { Id = 1, Name = "User 1", WindowsUsername = "user1" };
        var user2 = new User { Id = 2, Name = "User 2", WindowsUsername = "user2" };
        context.Users.AddRange(user1, user2);

        var bracket1 = new Bracket { Id = 1, UserId = 1, BracketName = "Bracket 1", Sport = "basketball-men", Year = 2025, SubmittedDate = DateTime.UtcNow };
        var bracket2 = new Bracket { Id = 2, UserId = 2, BracketName = "Bracket 2", Sport = "basketball-men", Year = 2025, SubmittedDate = DateTime.UtcNow };
        context.Brackets.AddRange(bracket1, bracket2);

        var game = new Game { Id = 1, ContestId = 201, Sport = "basketball-men", Year = 2025, Round = 3, WinnerId = 1, GameState = "final" };
        context.Games.Add(game);

        // User 1 correct pick, User 2 incorrect
        var pick1 = new Pick { BracketId = 1, GameId = 1, PickedTeamId = 1 }; // Correct
        var pick2 = new Pick { BracketId = 2, GameId = 1, PickedTeamId = 2 }; // Incorrect
        context.Picks.AddRange(pick1, pick2);

        await context.SaveChangesAsync();

        var service = new StandingsService(context);

        // Act
        var standings = await service.GetStandingsAsync("basketball-men", 2025);

        // Assert
        Assert.Equal(2, standings.Count);
        Assert.Equal("User 1", standings[0].UserName); // User 1 should be first with 20 points
        Assert.Equal("User 2", standings[1].UserName); // User 2 should be second with 0 points
        Assert.True(standings[0].TotalPoints > standings[1].TotalPoints);
    }
}
