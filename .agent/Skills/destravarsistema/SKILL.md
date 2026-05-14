---
name: destravarsistema
description: Clean reset for Vite/Node.js environment to fix blank screen and cache issues
---

# Destravar Sistema (Vite / React)

Sempre que ocorrer a situação de "Página em branco", "Erro invisível do React Reconciler", ou "Dev Server travado", proceda EXATAMENTE nesta ordem para destravar:

1. **Parar tudo agressivamente:**
   \`\`\`bash
   taskkill /F /IM node.exe
   \`\`\`
   *(Aguarde 3 segundos para garantir que as portas foram liberadas)*

2. **Deletar dependências corrompidas (Opcional, mas recomendado para erros bizarros):**
   \`\`\`bash
   Remove-Item -Recurse -Force node_modules
   \`\`\`

3. **Reinstalar os pacotes e rodar:**
   \`\`\`bash
   pnpm install
   pnpm dev --port 3000
   \`\`\`

4. **Regras Cruciais (O que verificar em tela branca):**
   - Incompatibilidade do `react-reconciler` (ex: usar `@react-three/fiber` 9+ em React 18 causa tela branca fatal com erro `Cannot read properties of undefined (reading 'S')`). Se houver, faça downgrade do pacote para a versão correta compatível com o React 18.
   - Imports inexistentes ou de pacotes desatualizados (ex: importar algo que não existe da `lucide-react` causa erro de ESBuild e trava a página inteira em branco sem erros óbvios).
