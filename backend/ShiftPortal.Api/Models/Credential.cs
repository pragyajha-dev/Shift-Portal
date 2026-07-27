namespace ShiftPortal.Api.Models;

public class Credential
{
    public Guid Id { get; set; }
    public Guid EnvironmentId { get; set; }
    public string RoleLabel { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string PasswordEncrypted { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }

    public ProjectEnvironment? Environment { get; set; }
}
