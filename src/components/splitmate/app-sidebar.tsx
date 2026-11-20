import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowLeftRight, ChevronsUpDown, LayoutDashboard, Plus, Receipt, Users, FolderKanban } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActiveGroup } from "@/lib/splitmate/store";

const NAV = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Expenses", url: "/expenses", icon: Receipt },
  { title: "Settle up", url: "/settle", icon: ArrowLeftRight },
  { title: "Members", url: "/members", icon: Users },
  { title: "Groups", url: "/groups", icon: FolderKanban },
] as const;

export function AppSidebar() {
  const { state: sb, setOpenMobile } = useSidebar();
  const collapsed = sb === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { group, state, dispatch } = useActiveGroup();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-4 px-3 pt-4">
        <Link to="/" className="flex items-center gap-2.5 px-1" onClick={() => setOpenMobile(false)}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary font-display text-lg font-black text-sidebar-primary-foreground">
            ₹
          </span>
          {!collapsed && (
            <span className="font-display text-xl font-extrabold tracking-tight text-sidebar-accent-foreground">
              Split<span className="text-sidebar-primary">Mate</span>
            </span>
          )}
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="border border-sidebar-border bg-sidebar-accent/60" tooltip={group?.name ?? "Pick a group"}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar text-lg">{group?.emoji ?? "➕"}</span>
              <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
                <span className="text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/60">Group</span>
                <span className="truncate text-sm font-semibold text-sidebar-accent-foreground">{group?.name ?? "No group yet"}</span>
              </span>
              <ChevronsUpDown className="ml-auto size-4 opacity-60" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Switch group</DropdownMenuLabel>
            {state.groups.map((g) => (
              <DropdownMenuItem key={g.id} onSelect={() => dispatch({ type: "setActiveGroup", id: g.id })} className="gap-2">
                <span className="text-base">{g.emoji}</span>
                <span className="truncate">{g.name}</span>
                {g.id === group?.id && <span className="ml-auto size-2 rounded-full bg-positive" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/groups" className="gap-2" onClick={() => setOpenMobile(false)}>
                <Plus className="size-4" /> New group
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent className="px-1">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {NAV.map((item) => {
                const active = item.url === "/" ? pathname === "/" : pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className="h-10 font-medium data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground"
                    >
                      <Link to={item.url} onClick={() => setOpenMobile(false)}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {!collapsed && (
        <SidebarFooter className="p-4">
          <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-3 text-xs leading-relaxed text-sidebar-foreground/70">
            <span className="font-semibold text-sidebar-accent-foreground">Tip:</span> settle with the fewest UPI payments from the{" "}
            <span className="text-sidebar-primary">Settle up</span> page.
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
