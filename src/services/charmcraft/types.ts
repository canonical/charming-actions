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

export interface Mapping {
  base: Base;
  releases: Array<Release>;
}

export interface Track {
  track: string;
  mappings: Array<Mapping>;
}

export type Status = Array<Track>;
