import { LayoutDashboard, Store, Package, ArrowLeftRight, Tags, Users, LogOut, Settings, ArrowRightLeft, FileBarChart, ShoppingCart, ClipboardCheck } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { ShoppingBag } from 'lucide-react';

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { isAdmin, signOut, profile } = useAuth();

  const mainItems = [
    { title: 'ড্যাশবোর্ড', url: '/', icon: LayoutDashboard },
    { title: 'শাখাসমূহ', url: '/branches', icon: Store },
    { title: 'প্রোডাক্ট', url: '/products', icon: Package },
    { title: 'বিক্রয়', url: '/sales', icon: ShoppingCart },
    { title: 'স্টক মুভমেন্ট', url: '/stock', icon: ArrowLeftRight },
    { title: 'শাখা ট্রান্সফার', url: '/transfer', icon: ArrowRightLeft },
    { title: 'রিপোর্ট', url: '/reports', icon: FileBarChart },
    { title: 'স্টক অডিট', url: '/stock-audit', icon: ClipboardCheck },
    { title: 'ক্যাটেগরি', url: '/categories', icon: Tags },
  ];

  const adminItems = [
    { title: 'ব্যবহারকারী', url: '/users', icon: Users },
    { title: 'সেটিংস', url: '/settings', icon: Settings },
  ];

  return (
    <Sidebar collapsible="icon" className="bg-gradient-sidebar">
      <SidebarContent>
        <div className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center shrink-0">
            <ShoppingBag className="w-[50px] h-[50px] text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <h2 className="font-bold text-sidebar-foreground font-heading text-base">দুবাই বোরকা হাউজ</h2>
              <p className="text-sidebar-foreground/60 text-sm">ইনভেন্টরি সিস্টেম</p>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">মূল মেনু</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map(item => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end={item.url === '/'} className="hover:bg-sidebar-accent text-lg my-[4px] py-[12px] px-[12px]" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/50">অ্যাডমিন</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map(item => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className="hover:bg-sidebar-accent text-lg my-[4px] py-[12px] px-[12px]" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        {!collapsed && (
          <div className="text-xs text-sidebar-foreground/60 mb-2 px-2">
            {profile?.full_name || 'ব্যবহারকারী'}
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent">
          <LogOut className="h-4 w-4 mr-2" />
          {!collapsed && 'লগআউট'}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
