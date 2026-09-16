import { NextResponse } from 'next/server';
import { COMMANDS, COMMAND_CATEGORIES } from '@drp/core';

export async function GET() {
  return NextResponse.json({ categories: COMMAND_CATEGORIES, commands: COMMANDS });
}
