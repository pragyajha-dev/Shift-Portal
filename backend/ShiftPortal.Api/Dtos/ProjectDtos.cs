namespace ShiftPortal.Api.Dtos;

public record PagedResult<T>(IReadOnlyList<T> Items, int TotalCount, int Page, int PageSize);

public record ProjectSummaryDto(Guid Id, string Name, DateTime CreatedAt, DateTime? UpdatedAt);

public record CredentialDto(Guid Id, string RoleLabel, string Username, string Password, int SortOrder);

public record EnvironmentDto(Guid Id, string Side, string Name, string Url, int SortOrder, List<CredentialDto> Credentials);

public record ProjectDetailDto(
    Guid Id,
    string Name,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    List<EnvironmentDto> Environments);

public record SaveCredentialRequest(string RoleLabel, string Username, string Password, int SortOrder);

public record SaveEnvironmentRequest(string Side, string Name, string Url, int SortOrder, List<SaveCredentialRequest> Credentials);

public record SaveProjectRequest(string Name, List<SaveEnvironmentRequest> Environments);
