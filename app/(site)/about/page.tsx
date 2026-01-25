import { org } from "@/app/resource";

export default function AboutPage() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="px-6 py-12 md:px-12 lg:px-24 max-w-6xl mx-auto">
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight tracking-tight">
          根服，
          <br />
          启动！！！
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
          我们正致力于构建一个和谐的 Minecraft 社区。
        </p>
      </section>

      {/* Hero Image */}
      <section className="px-6 md:px-12 lg:px-24 max-w-6xl mx-auto">
        <div className="w-full aspect-[16/9] bg-muted rounded-lg overflow-hidden">
          <img
            src="https://github.com/wonder-perfect/radical-website/blob/main/public/images/gallery/horizontal-8.jpg?raw=true"
            className="w-full h-full object-cover"
          />
        </div>
      </section>

      {/* Mission Statement - Dark Section */}
      <section className="bg-zinc-900 text-white mt-12 px-6 py-16 md:px-12 lg:px-24">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
            标语标语标语，
            <br />
            标语标语标语标语标语。
          </h2>
          <div className="mt-8 flex justify-end">
            <a
              href="#"
              className="text-white underline underline-offset-4 hover:text-gray-300 transition-colors"
            >
              
            </a>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-6 py-16 md:px-12 lg:px-24 border-t">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {org.features.map((feature) => (
              <div key={feature.title} className="space-y-4">
                <feature.icon className="w-8 h-8" strokeWidth={1.5} />
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
