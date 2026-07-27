namespace ShiftPortal.Api.Dtos;

public record LoginRequest(string Email, string Password);

public record LoginResponse(string Token, UserMeResponse User);

public record UserMeResponse(
    Guid Id,
    string FullName,
    string Email,
    string Role,
    bool MustChangePassword,
    DateTime? LastLoginAt);

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public record ChangePasswordResponse(string Token, UserMeResponse User);
