export type ResultToast = {
  message: string;
  title: string;
  tone: "success" | "error";
};

export type StaffTableAction = "deactivate" | "reactivate" | "delete";
