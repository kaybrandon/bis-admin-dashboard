FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY src/api/Bis.Admin.Api.csproj src/api/
RUN dotnet restore src/api/Bis.Admin.Api.csproj
COPY src/api/ src/api/
RUN dotnet publish src/api/Bis.Admin.Api.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "Bis.Admin.Api.dll"]
