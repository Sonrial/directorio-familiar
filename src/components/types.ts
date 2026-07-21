export type Method = { id?: string; type: "phone" | "mobile" | "email" | "other"; label: string; value: string; is_primary: boolean };
export type Address = { id?: string; label: string; line1: string; line2?: string | null; city?: string | null; region?: string | null; postal_code?: string | null; country: string; is_primary: boolean };
export type Category = { id: string; name: string; color: string };
export type Credential = { id: string; platform: string; username?: string | null; url?: string | null; notes?: string | null; updated_at: string };
export type Note = { id: string; body: string; created_at: string };
export type Contact = {
  id: string; kind: "person" | "company"; first_name?: string | null; middle_name?: string | null;
  last_name?: string | null; second_last_name?: string | null; display_name: string; legal_name?: string | null;
  document_type?: string | null; document_number?: string | null; tax_id?: string | null; verification_digit?: string | null;
  website?: string | null; birth_date?: string | null; status: "active" | "inactive"; custom_fields: Record<string, string>;
  methods: Method[]; addresses: Address[]; credentials: Credential[]; notes: Note[]; categories: Category[];
  created_at: string; updated_at: string;
};
export type AppUser = { id: string; email: string; name: string; role: "admin" | "member"; must_change_password: boolean };
export type FamilyUser = { id: string; email: string; name: string; role: string; active: boolean; last_login_at?: string | null };
export type AuditItem = { id: number; action: string; entity_type: string; entity_id?: string; metadata: Record<string, string>; created_at: string; user_name?: string };

