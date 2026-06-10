import { Sidebar } from "@/components/sidebar";
import { StaffDirectory, type StaffMember } from "@/components/staff_directory";
import { TopBar } from "@/components/top_bar";

export const trainers: StaffMember[] = [
  {
    id: "TR-001",
    name: "Sara Hassan",
    bio: "Senior reformer Pilates trainer focused on strength, posture, and safe progression.",
    specialties: ["Reformer", "Strength"],
    availability: "8:00 AM - 4:00 PM",
    days: "Sun - Thu",
    status: "Available",
    avatarTone: "bg-violet-100 text-violet-700",
    address: "Salmiya, Kuwait",
    email: "sara.hassan@lafam.test",
    firstName: "Sara",
    lastName: "Hassan",
    phone: "+965 5550 1001",
    post: "Senior Pilates Trainer",
  },
  {
    id: "TR-002",
    name: "Lina Ahmad",
    bio: "Mat Pilates and mobility coach helping members improve flexibility and body control.",
    specialties: ["Mat Pilates", "Mobility"],
    availability: "10:00 AM - 6:00 PM",
    days: "Mon - Sat",
    status: "Available",
    avatarTone: "bg-sky-100 text-sky-700",
    address: "Hawally, Kuwait",
    email: "lina.ahmad@lafam.test",
    firstName: "Lina",
    lastName: "Ahmad",
    phone: "+965 5550 1002",
    post: "Pilates Trainer",
  },
  {
    id: "TR-003",
    name: "Nour Al Salem",
    bio: "Certified prenatal Pilates trainer with a calm, supportive approach for every stage.",
    specialties: ["Prenatal", "Private sessions"],
    availability: "9:00 AM - 2:00 PM",
    days: "Sun - Wed",
    status: "On leave",
    avatarTone: "bg-amber-100 text-amber-700",
    address: "Jabriya, Kuwait",
    email: "nour.alsalem@lafam.test",
    firstName: "Nour",
    lastName: "Al Salem",
    phone: "+965 5550 1003",
    post: "Prenatal Pilates Trainer",
  },
  {
    id: "TR-004",
    name: "Rania Khalid",
    bio: "Dynamic group trainer specializing in functional movement and endurance sessions.",
    specialties: ["Group classes", "Endurance"],
    availability: "2:00 PM - 9:00 PM",
    days: "Tue - Sat",
    status: "Available",
    avatarTone: "bg-emerald-100 text-emerald-700",
    address: "Kuwait City, Kuwait",
    email: "rania.khalid@lafam.test",
    firstName: "Rania",
    lastName: "Khalid",
    phone: "+965 5550 1004",
    post: "Group Fitness Trainer",
  },
];

export default function StaffPage() {
  return (
    <div className="min-h-screen bg-background-primary md:flex">
      <Sidebar activeItem="Staff" />
      <div className="min-w-0 flex-1">
        <TopBar actionHref="#add-staff" actionLabel="+ Add staff" dateLabel="8 Jun 2026" description="Create staff accounts and manage availability" title="Staff" />
        <main className="p-4 lg:p-6">
          <StaffDirectory initialStaff={trainers} label="Staff member" pluralLabel="staff members" prefix="STF" storageKey="lafam-staff" />
        </main>
      </div>
    </div>
  );
}
