FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080

ENV ASPNETCORE_URLS=http://+:8080

# SDK build stage
FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG configuration=Release
WORKDIR /src

COPY ["LEAN-SUPPLY-API.csproj", "./"]
RUN dotnet restore "LEAN-SUPPLY-API.csproj"

COPY . .
WORKDIR "/src/."
RUN dotnet build "LEAN-SUPPLY-API.csproj" -c $configuration -o /app/build

# publish stage
FROM build AS publish
ARG configuration=Release
RUN dotnet publish "LEAN-SUPPLY-API.csproj" -c $configuration -o /app/publish /p:UseAppHost=false

# final stage
# final stage
FROM base AS final
WORKDIR /app

COPY --from=publish --chown=app:app /app/publish .

# Создаём папку и выдаём права на всю директорию /app от имени root
USER root
RUN mkdir -p /app/Files && chown -R app:app /app

# Возвращаем непривилегированного пользователя
USER app

ENTRYPOINT ["dotnet", "LEAN-SUPPLY-API.dll"]
