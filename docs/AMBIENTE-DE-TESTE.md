# Ambiente de teste (Vercel + Neon, gratuito)

Site privado para testar tudo antes do lançamento. Só abre para quem entra com a sua conta Vercel. Não aparece no Google e não vende nada de verdade: a loja fica fechada e o pagamento em modo de teste.

O plano gratuito da Vercel (Hobby) é só para uso pessoal, não comercial. Serve para testar. Para vender, o site vai para o Cloudflare (`docs/DEPLOY.md`), levando o mesmo banco de dados.

## Passo a passo (uns 15 minutos)

1. **Criar a conta.** Entre em **vercel.com** e clique em *Sign Up* → *Continue with GitHub*. Escolha o plano **Hobby**, que é gratuito.
2. **Importar o projeto.**
   1. Clique em *Add New…* → *Project* e importe **AcronosSite**.
   2. Na tela de importação, abra *Environment Variables* e adicione:

      | Nome | Valor |
      | --- | --- |
      | `APP_ENV` | `test` |
      | `BOOTSTRAP_ADMIN_EMAIL` | o seu e-mail (essa conta vira administradora) |
      | `BETTER_AUTH_SECRET` | uma senha aleatória longa (48+ caracteres, de um gerador de senhas). Guarde e **nunca troque**. |
      | `CRON_SECRET` | outra senha aleatória (32+ caracteres) |

   3. Clique em *Deploy*. A primeira tentativa vai falhar, porque ainda não há banco de dados. Isso é esperado.
3. **Banco de dados.**
   1. No projeto, abra *Storage* → *Create Database* → **Neon** (Postgres). Escolha o plano Free e a região US East.
   2. Conecte ao projeto. A Vercel preenche `DATABASE_URL` sozinha.
4. **Fotos.** Ainda em *Storage*, clique em *Create* → **Blob**, escolha acesso **Private** e conecte ao projeto. A Vercel preenche `BLOB_READ_WRITE_TOKEN`.
5. **Proteção.** Em *Settings* → *Deployment Protection*, ligue a **Vercel Authentication** para *All Deployments* (ou *Standard Protection* + produção).
6. **Publicar.** Em *Deployments* → *Redeploy*. O site cria as tabelas sozinho e fica no ar em um endereço `….vercel.app`.
7. **Primeiro acesso.**
   1. Abra o endereço e clique em *Sign in* → *Create account*, usando **o mesmo e-mail** de `BOOTSTRAP_ADMIN_EMAIL`.
   2. Em `/account/security`, ligue o código do celular (Google Authenticator, Authy ou 1Password).
   3. Abra `/admin`.

## O que dá para testar

Tudo do painel:
- produtos e fotos
- coleções
- estoque
- página inicial
- contos
- páginas
- pedidos
- relatórios
- usuários

Para testar o checkout com cartão de teste, crie uma conta gratuita no Stripe (o modo de teste não exige aprovação). Depois adicione `STRIPE_SECRET_KEY` (`sk_test_…`) e `STRIPE_WEBHOOK_SECRET` e configure loja e frete em *Admin → Settings*.

## Limites do plano gratuito

| Serviço | Limite |
| --- | --- |
| Banco (Neon) | 0,5 GB |
| Fotos (Blob) | conforme o plano Hobby |
| Limpeza automática | uma vez por dia; no Cloudflare será a cada 10 minutos |

Para um teste, sobra.
