import type { NextAuthOptions } from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID || '',
      clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
      authorization: { params: { scope: 'identify guilds' } },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account?.access_token) (token as any).discordAccessToken = account.access_token;
      return token;
    },
    async session({ session, token }) {
      const accessToken = (token as any).discordAccessToken as string | undefined;
      if (accessToken) (session as any).discordAccessToken = accessToken;
      return session;
    },
  },
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
};
