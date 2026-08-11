/*
Copyright (c) 2023-2024 latkerlo (https://github.com/latkerlo)
Licensed under the MIT License
*/

export class DecompositionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecompositionError";
  }
}

export class InvalidClusterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidClusterError";
  }
}

export class NoLujvoFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoLujvoFoundError";
  }
}

export class NonLojbanCharacterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonLojbanCharacterError";
  }
}

export class NotBrivlaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotBrivlaError";
  }
}

export class NotZihevlaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotZihevlaError";
  }
}
