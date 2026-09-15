# 📱 02. Mobile App APK (Passo 2 Detalhado)

Este guia documenta como empacotar e executar o **VUA (Vortex Universal Connector)** em ambiente móvel Android de forma **100% autônoma, sem dependência ou conexão com o GitHub**.

---

## 1. Identificador de Pacote (Package ID)

O identificador canônico e normatizado do VUA no ecossistema Android é:
```
com.vortex.foundation.vua
```
- **Target SDK**: Android 15 (API 35)
- **Min SDK**: Android 8.0 Oreo (API 26)
- **Arquiteturas Suportadas**: `arm64-v8a` (padrão smartphones modernos), `armeabi-v7a`, `x86_64`

---

## 2. Desacoplamento Total do Conector GitHub

Por concepção arquitetural, o VUA **não exige o conector GitHub para funcionar**:
- Os 4 adaptadores (`linux`, `android`, `windows`, `github`) são registrados de forma independente no `VUAAdapterRegistry`.
- Se a variável `GITHUB_TOKEN` estiver ausente, o adaptador `github` não faz chamadas de rede e permanece inativo ou em modo sandbox.
- Todo o motor de governança (canonicidade RFC 8785, assinatura Ed25519, verificação matemática de provas, sandbox local e adaptadores de SO) roda **100% offline dentro do dispositivo**.

---

## 3. Método A: Empacotar como APK Nativo com Capacitor (Passo a Passo)

O VUA pode ser convertido em um aplicativo `.apk` instalável diretamente a partir do código do projeto usando o **Capacitor**:

### Passo 1: Gerar a build estática de produção
```bash
npm run build
```
Isso gera a pasta `dist/` contendo todo o frontend otimizado e assets necessários.

### Passo 2: Adicionar o Capacitor no projeto
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android -D
```

### Passo 3: Inicializar a configuração do pacote Android
```bash
npx cap init "VUA Connector" "com.vortex.foundation.vua" --web-dir dist
```

### Passo 4: Gerar a pasta nativa Android
```bash
npx cap add android
```
Isso criará a pasta `android/` com todo o projeto Android Studio estruturado em Gradle.

### Passo 5: Ajustar o `AndroidManifest.xml` para Permissões Mínimas
Abra `android/app/src/main/AndroidManifest.xml`:
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.vortex.foundation.vua">

    <!-- Se for rodar 100% offline sem chamadas externas, até a permissão de internet pode ser removida -->
    <uses-permission android:name="android.permission.INTERNET" />

    <application
        android:allowBackup="false"
        android:icon="@mipmap/ic_launcher"
        android:label="VUA Connector"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">
        
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTask">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

### Passo 6: Compilar o APK Release / Debug
```bash
npx cap sync android
cd android
./gradlew assembleDebug
```
O arquivo APK gerado estará em:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

Instale no celular via ADB:
```bash
adb install app-debug.apk
```

---

## 4. Método B: Executar no Android via Termux (Sem Compilar APK)

Se você já usa o Android e não quer compilar um APK com o Android Studio, você pode rodar o VUA nativamente no celular via **Termux**:

1. Instale o **Termux** (preferencialmente via F-Droid).
2. Atualize os repositórios e instale o Node.js:
   ```bash
   pkg update -y
   pkg install nodejs git -y
   ```
3. Clone ou transfira os arquivos do VUA para o armazenamento do Termux:
   ```bash
   cd ~/
   git clone <seu-repo-vua> vua-connector
   cd vua-connector
   npm install
   ```
4. Teste o status e o adaptador Android:
   ```bash
   npm run vua status
   npm run vua invoke android check_selinux
   ```

---

## 5. Ações Governamentais do Adaptador Android no VUA

Mesmo sem o GitHub, o VUA no Android fornece ações de segurança e auditoria através do `Android Universal Adapter`:

| Ação | Descrição | Comando CLI |
| :--- | :--- | :--- |
| `check_selinux` | Audita se o kernel Android está em modo `Enforcing` com isolamento de categoria MLS por processo | `vua invoke android check_selinux` |
| `verify_apk` | Valida assinaturas APK Signature Scheme v2/v3 e integridade de hashes | `vua invoke android verify_apk '{"package_name":"com.vortex.foundation.vua"}'` |
| `scoped_storage_audit` | Confirma o isolamento de armazenamento isolado (Scoped Storage API 29+) | `vua invoke android scoped_storage_audit` |
| `inspect_device` | Coleta versão de API, modelo de dispositivo e nível de patch de segurança | `vua invoke android inspect_device` |

Exemplo de execução no terminal:
```bash
npm run vua invoke android check_selinux
```
Saída produzida:
```json
{
  "selinux_mode": "Enforcing",
  "policy_version": 34,
  "mls_isolation": "STRICT_MLS_CATEGORY_PER_APP",
  "denial_count": 0,
  "status": "SECURE_ENFORCED",
  "compliance": "PASS"
}
```
Todas as respostas geram um `ExecutionProof v1` assinado com Ed25519 válido localmente.
