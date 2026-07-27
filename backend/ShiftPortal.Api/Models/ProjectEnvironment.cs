namespace ShiftPortal.Api.Models;

// Named ProjectEnvironment (not "Environment") to avoid colliding with System.Environment.
// Maps to the "Environments" table per the PRD data model.
public class ProjectEnvironment
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public EnvironmentSide Side { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }

    public Project? Project { get; set; }
    public ICollection<Credential> Credentials { get; set; } = new List<Credential>();
}
