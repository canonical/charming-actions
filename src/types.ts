export type Resource = {
  type: string;
  name: string;
  'upstream-source': string;
};

export type PullRequestMetadata = {
  number: number;
  html_url?: string;
  body?: string;
  base: {
    ref: string;
    repo: {
      default_branch: string;
    };
  };
  head: {
    ref: string;
  };
};

export type Metadata = {
  name: string;
  resources: { [key: string]: Resource };
};

export interface Tokens {
  charmhub: string;
  github: string;
}

export interface Outcomes {
  fail: boolean;
  comment: boolean;
}
