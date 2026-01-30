using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MarchMadness.Web.Migrations
{
    /// <inheritdoc />
    public partial class AddBracketIdAndVictorPosition : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "BracketId",
                table: "Games",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "VictorBracketPositionId",
                table: "Games",
                type: "INTEGER",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BracketId",
                table: "Games");

            migrationBuilder.DropColumn(
                name: "VictorBracketPositionId",
                table: "Games");
        }
    }
}
