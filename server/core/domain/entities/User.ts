/**
 * User Entity
 *
 * Core domain entity representing a user in the system.
 * This is a pure domain object with no dependencies on infrastructure.
 */

export interface UserProps {
  id: string;
  email: string;
  name: string;
  password: string;
  role: "admin" | "user";
  status: "active" | "inactive" | "suspended";
  profile_image?: string;
  settings?: Record<string, any>;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

export class User {
  private props: UserProps;

  constructor(props: UserProps) {
    this.props = props;
  }

  get id(): string {
    return this.props.id;
  }

  get email(): string {
    return this.props.email;
  }

  get name(): string {
    return this.props.name;
  }

  get password(): string {
    return this.props.password;
  }

  get role(): "admin" | "user" {
    return this.props.role;
  }

  get status(): "active" | "inactive" | "suspended" {
    return this.props.status;
  }

  get profileImage(): string | undefined {
    return this.props.profile_image;
  }

  get settings(): Record<string, any> | undefined {
    return this.props.settings;
  }

  get lastLogin(): string | undefined {
    return this.props.last_login;
  }

  get createdAt(): string {
    return this.props.created_at;
  }

  get updatedAt(): string {
    return this.props.updated_at;
  }

  // Domain logic methods
  isActive(): boolean {
    return this.props.status === "active";
  }

  isAdmin(): boolean {
    return this.props.role === "admin";
  }

  hasPermissionToAccess(resourceOwnerId: string): boolean {
    return this.id === resourceOwnerId || this.isAdmin();
  }

  // Return a plain object representation of the entity
  toObject(): UserProps {
    return { ...this.props };
  }

  // Return a sanitized version for public API responses
  toDTO(): Omit<UserProps, "password"> {
    const { password, ...userDTO } = this.props;
    return userDTO;
  }
}
