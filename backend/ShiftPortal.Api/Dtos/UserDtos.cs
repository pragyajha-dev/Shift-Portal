namespace ShiftPortal.Api.Dtos;

public record UserSummaryDto(
    Guid Id,
    string FullName,
    string Email,
    string Role,
    bool MustChangePassword,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? LastLoginAt);

public record CreateUserRequest(string FullName, string Email, string Role);

public record CreateUserResponse(UserSummaryDto User, string TemporaryPassword);

public record UpdateUserRoleRequest(string Role);
