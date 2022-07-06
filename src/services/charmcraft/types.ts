export interface Base {
  name: string;
  channel: string;
  architecture: string;
}

export interface Resource {
  name: string;
  revision: number;
}

export interface Release {
  status: 'closed' | 'open' | 'tracking';
  channel: string;
  version: string;
  revision: number;
  resources: Array<Resource>;
}

export interface Channel {
  base: Base;
  releases: Array<Release>;
}

export interface Track {
  track: string;
  channels: Array<Channel>;
}

export type Status = Array<Track>;
