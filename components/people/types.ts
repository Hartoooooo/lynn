export type PersonTopic = { label: string; topic: { id: string; name: string; slug: string; color: string; icon: string } | null };

export type Person = {
  id: string;
  name: string;
  position: string;
  department: string;
  email: string;
  phone: string;
  teams_url: string;
  avatar_url: string | null;
  bio: string;
  tags: string[];
  topic_contacts: PersonTopic[];
};

export type TopicOption = { id: string; name: string; color: string; icon: string };
