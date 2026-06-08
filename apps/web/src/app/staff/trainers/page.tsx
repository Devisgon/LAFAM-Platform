import { Sidebar } from "@/components/sidebar";
import { StaffDirectory, type StaffMember } from "@/components/staff_directory";
import { TopBar } from "@/components/top_bar";

const trainers: StaffMember[] = [
  {
    id: "TR-001",
    name: "Sara Hassan",
    bio: "Senior reformer Pilates trainer focused on strength, posture, and safe progression.",
    specialties: ["Reformer", "Strength"],
    availability: "8:00 AM - 4:00 PM",
    days: "Sun - Thu",
    status: "Available",
    avatarTone: "bg-violet-100 text-violet-700",
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
  },
];

export default function TrainersPage() {
  return (
    <div className="min-h-screen bg-background-primary md:flex">
      <Sidebar activeItem="Trainers" />
      <div className="min-w-0 flex-1">
        <TopBar actionHref="#add-staff" actionLabel="+ Add trainer" dateLabel="8 Jun 2026" description="Manage Pilates trainers, schedules, and availability" title="Trainers" />
        <main className="p-4 lg:p-6">
          <StaffDirectory initialStaff={trainers} label="Trainer" pluralLabel="trainers" prefix="TR" storageKey="lafam-trainers" />
        </main>
      </div>
    </div>
  );
}
