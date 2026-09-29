import {
  ChartBar, CheckCircle, EnvelopeSimple, GearSix, GithubLogo,
  Users, UsersThree,
} from "@phosphor-icons/react";

export const PROJECT_SECTIONS = [
  { value: "overview", icon: ChartBar },
  { value: "criteria", icon: CheckCircle },
  { value: "members", icon: Users },
  { value: "invitations", icon: EnvelopeSimple, managerOnly: true },
  { value: "squads", icon: UsersThree },
  { value: "repository", icon: GithubLogo },
  { value: "settings", icon: GearSix, managerOnly: true },
] as const;

export type ProjectSection = (typeof PROJECT_SECTIONS)[number]["value"];

export function projectSection(value: string | null, isManager: boolean): ProjectSection {
  const section = PROJECT_SECTIONS.find(item => item.value === value);
  if (!section || ("managerOnly" in section && section.managerOnly && !isManager)) return "overview";
  return section.value;
}

export function projectSectionHref(pathname: string, section: ProjectSection): string {
  return section === "overview" ? pathname : `${pathname}?section=${section}`;
}
